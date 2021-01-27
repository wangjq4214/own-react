// 批量提交保存根
let wipRoot = null;

// 为了 diff 保存现在的节点
let currentRoot = null;

// 下一个 fiber 任务
let nextUnitOfWork = null;

// 跟踪需要删除的节点
let deletions = null;

// 判断是否是事件监听
const isEvent = key => key.startsWith('on');

// 判断是属性还是子节点
const isProperty = key => key !== 'children' && !isEvent(key);

// 判断是否是新属性
const isNew = (prev, next) => key => prev[key] !== next[key];

// 判断是否删除属性
const isGone = (prev, next) => key => !(key in next);

/**
 * 创建节点的描述对象
 * @param {*} type 节点类型
 * @param {*} props 节点属性
 * @param  {...any} children 子节点
 */
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === 'object' ? child : createTextElement(child),
      ),
    },
  };
}

/**
 * 创建纯文本节点的描述对象
 * @param {*} text 文本内容
 */
function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

/**
 * 创建 DOM 节点
 * @param {*} fiber
 */
function createDom(fiber) {
  // 根据不同类型创建不同的节点
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);

  return dom;
}

/**
 * 更新节点
 * @param {*} dom DOM 元素
 * @param {*} prevProps
 * @param {*} nextProps
 */
function updateDom(dom, prevProps, nextProps) {
  // 移除旧的以及已经改变的事件监听
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // 移除旧属性
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = '';
    });

  // 设置新的以及更新的属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name];
    });

  // 增加事件监听
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

/**
 * 将 fiber 节点进行提交
 * @param {*} fiber fiber 节点
 */
function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  const domParent = fiber.parent.dom;

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    // 替换 tag 进行更新
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    // 更新 tag 进行更新
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === 'DELETION') {
    // 删除 tag 删除节点
    domParent.removeChild(fiber.dom);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

/**
 * 提交更新
 */
function commitRoot() {
  // 删除需要删除的节点
  deletions.forEach(commitWork);

  commitWork(wipRoot.child);

  // 保存现在的 DOM 结构树
  currentRoot = wipRoot;
  // 重设 root
  wipRoot = null;
}

/**
 * 设置根节点与第一个 fiber
 * @param {*} element 我们的代码
 * @param {*} container 网页中的容器
 */
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };

  deletions = [];

  nextUnitOfWork = wipRoot;
}

/**
 * 通过 requestIdleCallback 函数
 * 在浏览器空闲时执行更新
 * @param {*} deadline
 */
function workLoop(deadline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    shouldYield = deadline.timeRemaining() < 1;
  }

  // 为了避免视图不完全更新
  // 当所有节点生成完成后提交更新
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

/**
 * 节点更新 创建 删除算法
 * @param {*} wipFiber 当前节点
 * @param {*} elements 子节点
 */
function reconcileChildren(wipFiber, elements) {
  // 节点索引
  let index = 0;

  // 判断是否有老节点需要 diff
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;

  // 保存上一个节点 进行连接
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    // 判断当前节点和更新后的节点是否是相同类型节点
    const sameType = oldFiber && element && element.type === oldFiber.type;

    // 如果相同类型, 只更新 Props 并且附加更新标记
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      };
    }

    // 不同类型, 有新节点的
    // 清空 DOM 重新设置 type Props
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT',
      };
    }

    // 如果节点是需要删除的 增加 tag 加入到删除数组中
    if (oldFiber && !sameType) {
      oldFiber.effectTag = 'DELETION';
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    // 将所有的 children 通过链表的方式串联起来
    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

/**
 * 创建下一个 fiber 工作单元
 * @param {*} fiber 当前 fiber
 */
function performUnitOfWork(fiber) {
  // 创建 fiber 对应的 DOM
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 执行节点更新策略
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

  // 如果有子节点先返回子节点
  if (fiber.child) {
    return fiber.child;
  }

  // 没有子节点返回其叔叔节点(父节点的兄弟节点)
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }

    nextFiber = nextFiber.parent;
  }
}

requestIdleCallback(workLoop);

export default {
  createElement,
  render,
};
