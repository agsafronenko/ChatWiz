/**
 * Format ISO timestamp to a user-friendly time string
 * @param {string} timestamp - ISO format timestamp
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
  if (!timestamp) return "";

  try {
    const date = new Date(timestamp);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "";
    }

    // Format as HH:MM or date if not today
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && 
                     date.getMonth() === today.getMonth() && 
                     date.getFullYear() === today.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + 
             date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  } catch (e) {
    console.error("Error formatting time:", e);
    return timestamp;
  }
}
