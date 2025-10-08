

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");
const uploadSection = document.getElementById("upload-section");
const querySection = document.getElementById("query-section");
const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const answerOutput = document.getElementById("answerOutput");
const themeToggle = document.getElementById("themeToggle");

let sessionId = null;





// Theme toggle
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
  themeToggle.textContent = document.body.classList.contains("dark")
    ? "☀️"
    : "🌙";
});

// Upload file
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    uploadStatus.textContent = "Please select a file first!";
    return;
  }

  const formData = new FormData();
  formData.append("excelFile", file);

  uploadStatus.textContent = "Uploading...";
  try {
    const res = await fetch(
      `https://quickref-3l6q.onrender.com/upload-context`,
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await res.json();

    if (data.success) {
      uploadStatus.textContent = "File uploaded successfully! Session ready.";
      sessionId = data.sessionId;

      // Hide upload section and show query section
      setTimeout(() => {
        uploadSection.style.display = "none";
        querySection.style.display = "block";
      }, 500);
    } else {
      uploadStatus.textContent = "Upload failed: " + data.message;
    }
  } catch (err) {
    uploadStatus.textContent = "Error uploading file: " + err.message;
  }
});

askBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!question || !sessionId) return;

  answerOutput.textContent = "Thinking...";

  try {
    const res = await fetch("https://quickref-3l6q.onrender.com/query-gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, question }),
    });

    const data = await res.json();

    if (data.success) {
      // Option 1: Simple formatting
      answerOutput.innerHTML = marked.parse(data.answer);
    } else {
      answerOutput.textContent = "Error: " + data.message;
    }
  } catch (err) {
    answerOutput.textContent = "Error: " + err.message;
  }
});
