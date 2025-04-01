from flask import Flask
from flask_socketio import SocketIO
import os
from config import Config
from sockets.events import register_socket_events
import dotenv

# Load environment variables from .env file
dotenv.load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Register socket events
register_socket_events(socketio)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
