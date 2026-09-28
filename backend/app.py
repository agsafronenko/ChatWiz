# --- START OF FILE app.py ---

from flask import Flask
from flask_socketio import SocketIO
import os
# Remove Config import if not used directly here
# from config import Config
from sockets.events import register_socket_events # Ensure correct import path
import dotenv

# Load environment variables from .env file
dotenv.load_dotenv()

# Initialize Flask app
app = Flask(__name__) # No need for static_folder/template_folder if served otherwise

# Initialize SocketIO
# Added engineio_logger and logger for more detailed debugging if needed
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=True, logger=True)

# Register socket events
register_socket_events(socketio)

# Add a simple root route for health check or basic info
@app.route('/')
def index():
    return "Chat Server Backend Running"

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    # Use debug=False in production, allow_unsafe_werkzeug=True needed for debugger with reloader
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)

# --- END OF FILE app.py ---