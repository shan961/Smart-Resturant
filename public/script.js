// script.js

document.addEventListener("DOMContentLoaded", () => {
  const chatHistory = document.getElementById("chat-history");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  // Create message div with appropriate class
  function createMessage(text, sender) {
    const msg = document.createElement("div");
    msg.classList.add("message");
    if (sender === "user") {
      msg.classList.add("user-message");
    } else {
      msg.classList.add("bot-message");
    }
    msg.textContent = text;
    return msg;
  }

  // Add a typing indicator
  let typingIndicator = null;
  function showTyping() {
    if (!typingIndicator) {
      typingIndicator = document.createElement("div");
      typingIndicator.classList.add("typing-indicator", "show");
      typingIndicator.textContent = "Typing...";
      // Add at the top because chat-history is reversed column
      chatHistory.prepend(typingIndicator);
    }
  }
  function hideTyping() {
    if (typingIndicator) {
      typingIndicator.remove();
      typingIndicator = null;
    }
  }

  // Scroll chat to bottom (bottom of flex column-reverse)
  function scrollToBottom() {
    // Because flex-direction: column-reverse, scrollTop=0 is bottom
    chatHistory.scrollTop = 0;
  }

  // Send message to backend
  async function sendMessage(text) {
    // Add user message
    const userMsg = createMessage(text, "user");
    chatHistory.prepend(userMsg);
    scrollToBottom();

    showTyping();

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      hideTyping();

      if (!response.ok) {
        const errMsg = createMessage("Oops! Server error, please try again later.", "bot");
        chatHistory.prepend(errMsg);
        scrollToBottom();
        return;
      }

      const data = await response.json();

      let botText = "";
      if (data.error) {
        botText = `Error: ${data.error}`;
      } else {
        // Show only the answer without tool prefix
        botText = data.answer;
      }

      const botMsg = createMessage(botText, "bot");
      chatHistory.prepend(botMsg);
      scrollToBottom();
    } catch (error) {
      hideTyping();
      const errMsg = createMessage("Network error. Please check your connection.", "bot");
      chatHistory.prepend(errMsg);
      scrollToBottom();
      console.error("Fetch error:", error);
    }
  }

  // Send message on button click or Enter key
  function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;
    sendMessage(text);
    userInput.value = "";
    userInput.focus();
  }

  sendButton.addEventListener("click", handleSend);

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
});
