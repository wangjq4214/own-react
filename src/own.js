let wipRoot = null;
let nextUnitOfWork = null;

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

  // 过滤 children 属性的函数
  const isProperty = key => key !== 'children';

  // 将 Props 中的属性附加到节点中
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = fiber.props[name];
    });

  return dom;
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
  domParent.appendChild(fiber.dom);
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

/**
 * 提交更新
 */
function commitRoot() {
  commitWork(wipRoot.child);

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
  };

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
 * 创建下一个 fiber 工作单元
 * @param {*} fiber 当前 fiber
 */
function performUnitOfWork(fiber) {
  // 创建 fiber 对应的 DOM
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 将所有的 children 通过链表的方式串联起来
  const elements = fiber.props.children;
  let index = 0;
  let prevSibling = null;
  while (index < elements.length) {
    const element = elements[index];

    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    };

    if (index === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }

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
