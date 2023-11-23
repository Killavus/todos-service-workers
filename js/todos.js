// Redacted.
const API_ROOT = "<api root here>";

async function getTodos() {
  const response = await fetch(`${API_ROOT}/todos`, {
    method: "GET",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();
  return data;
}

class TodosApp extends EventTarget {
  constructor({ get, set }) {
    super();
    this.addEventListener("app.sync", this.sync.bind(this));
    this._todos = [];

    this.getPersist = get;
    this.setPersist = set;
  }

  async start() {
    this.actions = this.getPersist() ?? [];
    await this.sync();
  }

  async todos() {
    const todosMap = await getTodos();
    let todos = Object.values(todosMap);

    for (const action of this.actions) {
      switch (action.type) {
        case "ADD": {
          const { id, task, createdAt } = action;

          todos.push({ id, task, createdAt, completed: false });
          break;
        }
        case "TOGGLE": {
          const { id } = action;

          const todo = todos.find((todo) => todo.id === id);
          todo.completed = !todo.completed;
          break;
        }
        case "DELETE": {
          const { id } = action;
          const index = todos.findIndex((todo) => todo.id === id);
          todos = todos.splice(index, 1);
          break;
        }
      }
    }

    todos.sort((a, b) => {
      const aCreated = a.createdAt;
      const bCreated = b.createdAt;

      if (aCreated < bCreated) {
        return -1;
      } else if (aCreated === bCreated) {
        return 0;
      } else {
        return 1;
      }
    });

    this._todos = todos;
    return todos;
  }

  async handleAction(action) {
    switch (action.type) {
      case "ADD": {
        const { id, task } = action;
        try {
          const response = await fetch(`${API_ROOT}/todos`, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, task }),
          });

          return response.ok;
        } catch {
          return false;
        }
      }
      case "TOGGLE": {
        const { id } = action;

        try {
          const response = await fetch(`${API_ROOT}/todos/${id}`, {
            method: "PATCH",
            mode: "cors",
          });

          return response.ok;
        } catch {
          return false;
        }
      }
      case "DELETE": {
        const { id } = action;

        try {
          const response = await fetch(`${API_ROOT}/todos/${id}`, {
            method: "DELETE",
            mode: "cors",
          });

          return response.ok;
        } catch {
          return false;
        }
      }
    }
  }

  async dispatch(action) {
    this.actions.push(action);
    this.dispatchEvent(new Event("app.sync"));
  }

  async sync() {
    let successful = 0;
    for (const action of this.actions) {
      const success = await this.handleAction(action);

      if (!success) {
        break;
      }

      successful += 1;
    }

    this.actions = this.actions.slice(successful);
    this.setPersist(this.actions);
    this.dispatchEvent(new Event("app.syncComplete"));
  }
}

async function refreshTodos(app) {
  const todos = await app.todos();
  const todosContainer = document.getElementById("todo-list");
  todosContainer.innerHTML = "";

  todos.forEach((todo) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;

    const item = document.createElement("li");

    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "x";
    deleteBtn.setAttribute("data-delete", "true");
    const itemBox = document.createElement("label");
    const itemLabel = document.createElement("p");

    if (todo.completed) {
      itemLabel.classList.add("completed");
    }

    item.setAttribute("data-id", todo.id);
    itemLabel.innerText = todo.task;
    itemBox.appendChild(checkbox);
    itemBox.appendChild(itemLabel);
    item.appendChild(itemBox);
    item.appendChild(deleteBtn);
    todosContainer.appendChild(item);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const todoAdd = document.getElementById("todo-add");

  const app = new TodosApp({
    get() {
      const todoActions = localStorage.getItem("app.todoActions");
      return todoActions ? JSON.parse(todoActions) : null;
    },
    set(todoActions) {
      localStorage.setItem("app.todoActions", JSON.stringify(todoActions));
    },
  });

  let wentOffline = false;
  window.addEventListener("online", () => {
    console.log("online!", { wentOffline });
    if (wentOffline) {
      app.sync();
    }

    wentOffline = false;
  });
  window.addEventListener("offline", () => {
    wentOffline = true;
  });

  app.addEventListener("app.syncComplete", () => refreshTodos(app));
  app.start();

  todoAdd.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const task = formData.get("task");
    app.dispatch({
      type: "ADD",
      id: ULID.ulid(),
      task,
      createdAt: new Date().toISOString(),
    });

    todoAdd.reset();
  });

  const todosContainer = document.getElementById("todo-list");

  todosContainer.addEventListener("change", async (e) => {
    const parent = e.target.parentElement.parentElement;
    const id = parent.getAttribute("data-id");

    app.dispatch({ type: "TOGGLE", id });
  });

  todosContainer.addEventListener("click", async (e) => {
    if (e.target.hasAttribute("data-delete")) {
      const parent = e.target.parentElement;
      const id = parent.getAttribute("data-id");
      app.dispatch({ type: "DELETE", id });

      e.preventDefault();
    }
  });
});
