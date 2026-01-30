const vscode = acquireVsCodeApi();
let currentLanguage = null;
let currentCourse = null;

// Course configuration
const courses = {
  C: ["PRF192"],
  Java: ["PRO192", "PRJ301"],
  Python: ["PFP191"],
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Language selection
  document.querySelectorAll(".sidebar .generator-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      const lang = item.dataset.lang;
      if (lang) {
        selectLanguage(lang);
      } else {
        // This is a course item
        const courseCode = item.dataset.course;
        if (courseCode) {
          selectCourse(courseCode);
        }
      }
    });
  });

  // Default selection
  selectLanguage("Java");
});

//Select language and show courses
function selectLanguage(lang) {
  currentLanguage = lang;

  // Update active state for language items
  document.querySelectorAll(".sidebar .generator-item").forEach((item) => {
    if (item.dataset.lang === lang) {
      item.classList.add("active");
    } else if (item.dataset.lang) {
      item.classList.remove("active");
    }
  });

  // Hide all forms first
  document
    .querySelectorAll(".form-container")
    .forEach((f) => f.classList.remove("active"));

  // Update course list
  updateCourseList(lang);

  // Auto select first course
  const firstCourse = courses[lang]?.[0];
  if (firstCourse) {
    selectCourse(firstCourse);
  }
}

// Update course list in sidebar
function updateCourseList(lang) {
  const courseList = document.getElementById("course-list");
  const langCourses = courses[lang] || [];

  courseList.innerHTML = "";
  langCourses.forEach((course) => {
    const item = document.createElement("div");
    item.className = "generator-item";
    item.dataset.course = course;
    item.innerHTML = `
            <span class="icon">📚</span>
            <span>${course}</span>
        `;
    item.addEventListener("click", () => selectCourse(course));
    courseList.appendChild(item);
  });
}

// Select course and show corresponding form
function selectCourse(courseCode) {
  currentCourse = courseCode;

  // Update active state
  document.querySelectorAll("#course-list .generator-item").forEach((item) => {
    if (item.dataset.course === courseCode) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Show corresponding form
  document
    .querySelectorAll(".form-container")
    .forEach((f) => f.classList.remove("active"));

  if (currentLanguage === "Java") {
    if (courseCode === "PRO192") {
      document.getElementById("java-pro192-form")?.classList.add("active");
    } else if (courseCode === "PRJ301") {
      document.getElementById("java-prj301-form")?.classList.add("active");
    }
  } else if (currentLanguage === "C") {
    document.getElementById("c-form")?.classList.add("active");
  } else if (currentLanguage === "Python") {
    document.getElementById("python-form")?.classList.add("active");
  }
}

//Generate project
function generateProject() {
  if (!currentLanguage) {
    showMessage("Please select a language", "error");
    return;
  }

  if (!currentCourse) {
    showMessage("Please select a course", "error");
    return;
  }

  const formData = {};
  const lang = currentLanguage;
  const course = currentCourse;

  if (lang === "C") {
    formData.course = "PRF192";
    formData.projectName = document.getElementById("c-project-name").value;
    formData.author = document.getElementById("c-author").value;
    formData.github = document.getElementById("c-github").value;

    if (!formData.projectName.trim()) {
      showMessage("Project name is required", "error");
      return;
    }
  } else if (lang === "Java" && course === "PRO192") {
    formData.course = "PRO192";
    formData.projectName = document.getElementById("pro192-project-name").value;
    formData.author = document.getElementById("pro192-author").value;
    formData.github = document.getElementById("pro192-github").value;
    formData.language = "Java";
    formData.buildSystem = document.getElementById("pro192-build").value;
    formData.javaVersion = document.getElementById("pro192-java-version").value;
    formData.mainClassName = document.getElementById("pro192-main-class").value;
    formData.addSampleCode = true;

    if (!formData.projectName.trim()) {
      showMessage("Project name is required", "error");
      return;
    }

    // Main class name is optional - no validation needed
  } else if (lang === "Java" && course === "PRJ301") {
    formData.course = "PRJ301";
    formData.project_name = document.getElementById("prj301-project-name").value;
    formData.author = document.getElementById("prj301-author").value;
    formData.github = document.getElementById("prj301-github").value;
    formData.server = document.getElementById("prj301-server").value;
    formData.buildSystem = document.getElementById("prj301-build").value;
    formData.javaVersion = document.getElementById("prj301-java-version").value;
    formData.database = document.getElementById("prj301-database").value;
    formData.mvc = document.getElementById("prj301-mvc").value;
    formData.jstl = document.getElementById("prj301-jstl").checked;
    formData.main_servlet_name = document.getElementById("prj301-main-class").value;
    formData.addSampleCode = true;

    if (!formData.project_name.trim()) {
      showMessage("Project name is required", "error");
      return;
    }

    // Main class name is optional - no validation needed
  } else if (lang === "Python") {
    formData.course = "PFP191";
    formData.projectName = document.getElementById("python-project-name").value;
    formData.description = document.getElementById("python-description").value;
    formData.fullName = document.getElementById("python-full-name").value;
    formData.github = document.getElementById("python-github").value;
    formData.pythonVersion = document.getElementById("python-py-version").value;
    formData.license = document.getElementById("python-license").value;
    formData.useDocker = document.getElementById("python-docker").value;

    if (!formData.projectName.trim()) {
      showMessage("Project name is required", "error");
      return;
    }
  }

  // Send to extension
  vscode.postMessage({
    command: "generateProject",
    data: { language: lang, formData },
  });

  showMessage("Generating project...", "success");
}

//Show message
function showMessage(text, type) {
  const messageEl = document.getElementById("message");
  if (!messageEl) {
    console.warn("Message element not found");
    return;
  }

  messageEl.textContent = text;
  messageEl.className = `message ${type} show`;

  setTimeout(() => {
    messageEl.classList.remove("show");
  }, 5000);
}

// Close window (send message to extension)
function closeWindow() {
  vscode.postMessage({ command: "close" });
}

// Listen for messages from extension
window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "success":
      showMessage(message.message, "success");
      break;
    case "error":
      showMessage(message.message, "error");
      break;
  }
});
