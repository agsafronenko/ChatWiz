// --- START OF FILE js/roomManager.js ---

class RoomManager {
  constructor(socketService, messageManager) {
    this.socketService = socketService;
    this.messageManager = messageManager;
    this.rooms = {}; // { roomName: { type: 'public'/'private', members: [userId1, ...] } }
    this.users = {}; // { userId: { username: '...', ... } }
    this.currentRoom = "main";
    this.currentUser = { user_id: null, username: null };
    this.onlineUsers = {}; // { userId: username } For invite list

    // DOM Elements
    this.publicRoomListEl = document.getElementById("publicRoomList");
    this.privateRoomListEl = document.getElementById("privateRoomList");
    this.addPublicRoomBtn = document.getElementById("addPublicRoomBtn");
    this.addPrivateRoomBtn = document.getElementById("addPrivateRoomBtn");
    this.currentRoomNameEl = document.getElementById("currentRoomName");

    // Invite Panel Elements
    this.invitePanelEl = document.getElementById("invitePanel");
    this.inviteRoomNameEl = document.getElementById("inviteRoomName");
    this.inviteUserListEl = document.getElementById("inviteUserList");
    this.closeInvitePanelBtn = document.getElementById("closeInvitePanelBtn");

    // Templates
    this.roomItemTemplate = document.getElementById("roomItemTemplate");
    this.userListItemTemplate = document.getElementById("userListItemTemplate");
    this.roomNameInputTemplate = document.getElementById("roomNameInputTemplate");
    this.inviteUserItemTemplate = document.getElementById("inviteUserItemTemplate");

    this._bindEvents();
  }

  _bindEvents() {
    // Clicking on a room name to join
    this.publicRoomListEl.addEventListener("click", this._handleRoomClick.bind(this));
    this.privateRoomListEl.addEventListener("click", this._handleRoomClick.bind(this));

    // Clicking '+' buttons
    this.addPublicRoomBtn.addEventListener("click", () => this._startAddRoom("public"));
    this.addPrivateRoomBtn.addEventListener("click", () => this._startAddRoom("private"));

     // Clicking invite button on a private room
     this.privateRoomListEl.addEventListener("click", this._handleInviteClick.bind(this));
     // Clicking invite button within the invite panel
     this.inviteUserListEl.addEventListener("click", this._handleInviteUserAction.bind(this));
     // Closing the invite panel
     this.closeInvitePanelBtn.addEventListener("click", this._hideInvitePanel.bind(this));
  }

  setCurrentUser(userData) {
    this.currentUser = userData;
    this.renderSidebar(); // Re-render to potentially highlight "(you)"
  }

   setCurrentRoom(roomName) {
       if (this.currentRoom !== roomName) {
           console.log(`Setting current room to: ${roomName}`);
           this.currentRoom = roomName;
           this.currentRoomNameEl.textContent = roomName; // Update UI indicator
           this.renderSidebar(); // Re-render to highlight the active room
           this.messageManager.clearMessages(); // Clear messages from old room
           // History will be loaded by the 'joined_room' event handler in app.js
       }
   }

   setOnlineUsers(userMap) {
        this.onlineUsers = userMap || {};
        // Potentially update the invite panel if it's open
        if (this.invitePanelEl.style.display !== 'none') {
             const roomNameToInvite = this.inviteRoomNameEl.textContent;
             if (roomNameToInvite) {
                 this._showInvitePanel(roomNameToInvite); // Refresh the list
             }
        }
    }

  updateRoomData(roomData, userData) {
    console.log("Updating room data:", roomData, userData);
    this.rooms = roomData || {};
    this.users = userData || {}; // Store user details {id: {username, ...}}
    this.renderSidebar();
  }

  // --- Room Joining ---
   _handleRoomClick(event) {
       const roomItem = event.target.closest(".room-item");
       if (roomItem && !roomItem.classList.contains('editing')) {
           const roomName = roomItem.dataset.roomName;
           if (roomName && roomName !== this.currentRoom) {
               console.log(`Requesting to join room: ${roomName}`);
               this.socketService.joinRoom(roomName);
               // Actual room switch and message loading happens on 'joined_room' event
           }
       }
   }


  // --- Room Creation ---
  _startAddRoom(type) {
    // Check if already editing
    if (this.publicRoomListEl.querySelector('.editing') || this.privateRoomListEl.querySelector('.editing')) {
        console.log("Already adding a room.");
        return;
    }

    const listElement = type === "public" ? this.publicRoomListEl : this.privateRoomListEl;
    const template = this.roomNameInputTemplate.content.cloneNode(true);
    const inputLi = template.querySelector('.room-item.editing');
    const input = template.querySelector(".room-name-input");
    const errorSpan = template.querySelector(".validation-error");

    listElement.prepend(template); // Add to top
    input.focus();

    const cleanup = () => {
        input.removeEventListener("blur", handleBlur);
        input.removeEventListener("keydown", handleKeydown);
        if (inputLi.parentNode) {
             inputLi.remove();
        }
    };

    const saveRoom = () => {
        const roomName = input.value.trim();
        if (!roomName) {
            errorSpan.textContent = "Room name cannot be empty.";
            errorSpan.style.display = "inline";
            input.focus(); // Keep focus
            return; // Don't cleanup yet
        }
        // Basic check for existing name (server does definitive check)
        if (this.rooms[roomName]) {
             errorSpan.textContent = "Room name already exists.";
             errorSpan.style.display = "inline";
             input.focus(); // Keep focus
             return; // Don't cleanup yet
        }

        console.log(`Creating ${type} room: ${roomName}`);
        this.socketService.createRoom(roomName, type);
        cleanup(); // Remove input on success
    };

    const handleBlur = () => {
        // Use setTimeout to allow click on potential error message or button
        setTimeout(() => {
             // If input still exists and hasn't been handled by Enter key
             if (document.activeElement !== input && inputLi.parentNode) {
                  console.log("Input blurred, cancelling add room.");
                  cleanup();
             }
        }, 100);
    };


    const handleKeydown = (e) => {
         errorSpan.style.display = "none"; // Hide error on key press
         if (e.key === "Enter") {
             e.preventDefault();
             saveRoom();
         } else if (e.key === "Escape") {
             e.preventDefault();
             console.log("Cancelled add room via Escape.");
             cleanup();
         }
     };

    input.addEventListener("blur", handleBlur);
    input.addEventListener("keydown", handleKeydown);
  }

   // --- Invites ---
   _handleInviteClick(event) {
       const inviteButton = event.target.closest(".invite-btn");
       if (inviteButton) {
           event.stopPropagation(); // Prevent room join click
           const roomItem = inviteButton.closest(".room-item");
           const roomName = roomItem.dataset.roomName;
           console.log(`Invite button clicked for room: ${roomName}`);
           this._showInvitePanel(roomName);
       }
   }

   _showInvitePanel(roomName) {
        if (!this.rooms[roomName] || this.rooms[roomName].type !== 'private') return;

        this.inviteRoomNameEl.textContent = roomName;
        this.inviteUserListEl.innerHTML = ''; // Clear previous list

        const membersInRoom = new Set(this.rooms[roomName].members);
        let usersToShow = 0;

        Object.entries(this.onlineUsers).forEach(([userId, username]) => {
             // Show online users who are NOT already in the room and NOT the current user
             if (userId !== this.currentUser.user_id && !membersInRoom.has(userId)) {
                 const template = this.inviteUserItemTemplate.content.cloneNode(true);
                 const li = template.querySelector('.invite-user-item');
                 li.dataset.userId = userId;
                 template.querySelector('.username').textContent = username;
                 this.inviteUserListEl.appendChild(template);
                 usersToShow++;
             }
        });

       if(usersToShow === 0) {
            this.inviteUserListEl.innerHTML = '<li>No other users available to invite.</li>';
       }

        this.invitePanelEl.style.display = 'block';
    }

    _hideInvitePanel() {
         this.invitePanelEl.style.display = 'none';
         this.inviteUserListEl.innerHTML = '';
         this.inviteRoomNameEl.textContent = '';
     }

     _handleInviteUserAction(event) {
          const inviteActionButton = event.target.closest(".invite-action-btn");
          if (inviteActionButton) {
               const userItem = inviteActionButton.closest(".invite-user-item");
               const targetUserId = userItem.dataset.userId;
               const roomName = this.inviteRoomNameEl.textContent; // Get room name from panel title

               if (targetUserId && roomName) {
                   console.log(`Inviting user ${targetUserId} to room ${roomName}`);
                   this.socketService.inviteUser(targetUserId, roomName);
                   // Optionally disable button or show feedback
                   inviteActionButton.textContent = 'Invited';
                   inviteActionButton.disabled = true;
               }
          }
     }


  // --- Rendering ---
  renderSidebar() {
    this.publicRoomListEl.innerHTML = ""; // Clear existing lists
    this.privateRoomListEl.innerHTML = "";

    // Sort rooms alphabetically, case-insensitive, with 'main' first
    const sortedRoomNames = Object.keys(this.rooms).sort((a, b) => {
         if (a === 'main') return -1;
         if (b === 'main') return 1;
         return a.toLowerCase().localeCompare(b.toLowerCase());
     });


    sortedRoomNames.forEach((roomName) => {
      const roomData = this.rooms[roomName];
      if (!roomData) return; // Skip if data is missing

      const roomItem = this.renderRoomItem(roomName, roomData);
      if (roomData.type === "public") {
        this.publicRoomListEl.appendChild(roomItem);
      } else if (roomData.type === "private") {
         // Only show private rooms if the current user is a member
         if (roomData.members && roomData.members.includes(this.currentUser.user_id)) {
            this.privateRoomListEl.appendChild(roomItem);
         }
      }
    });

     // Ensure invite panel is hidden if the room it was showing is gone or no longer private
     const invitePanelRoom = this.inviteRoomNameEl.textContent;
     if (this.invitePanelEl.style.display !== 'none' &&
         (!this.rooms[invitePanelRoom] || this.rooms[invitePanelRoom].type !== 'private')) {
         this._hideInvitePanel();
     }

  }

  renderRoomItem(roomName, roomData) {
    const template = this.roomItemTemplate.content.cloneNode(true);
    const roomItem = template.querySelector(".room-item");
    const roomNameSpan = template.querySelector(".room-name");
    const userListUl = template.querySelector(".user-list");
    const inviteButton = template.querySelector(".invite-btn");


    roomItem.dataset.roomName = roomName;
    roomNameSpan.textContent = roomName;

    // Highlight active room
    if (roomName === this.currentRoom) {
      roomItem.classList.add("active");
    }

     // Show invite button only for private rooms where the current user is a member
     if (roomData.type === 'private' && roomData.members.includes(this.currentUser.user_id)) {
         inviteButton.style.display = 'inline-block';
     }

    // Populate user list for the room
    userListUl.innerHTML = ""; // Clear previous users
    if (roomData.members && Array.isArray(roomData.members)) {
       // Sort users: current user first, then alphabetically
       const sortedMembers = [...roomData.members].sort((a, b) => {
            if (a === this.currentUser.user_id) return -1;
            if (b === this.currentUser.user_id) return 1;
            const nameA = this.users[a]?.username.toLowerCase() || '';
            const nameB = this.users[b]?.username.toLowerCase() || '';
            return nameA.localeCompare(nameB);
       });

      sortedMembers.forEach((userId) => {
        const user = this.users[userId]; // Get user details
        if (user) {
           const userLi = this.renderUserListItem(user);
           userListUl.appendChild(userLi);
        } else {
           console.warn(`User data not found for ID: ${userId} in room ${roomName}`);
           // Optionally display placeholder
           const userLi = document.createElement('li');
           userLi.textContent = `User ${userId.substring(0, 6)}...`;
           userLi.style.fontStyle = 'italic';
           userLi.style.color = '#aaa';
           userListUl.appendChild(userLi);
        }
      });
    }

    return roomItem;
  }

  renderUserListItem(user) {
    const template = this.userListItemTemplate.content.cloneNode(true);
    const userLi = template.querySelector(".user-list-item");
    const usernameSpan = template.querySelector(".username");

    userLi.dataset.userId = user.user_id; // Assuming user object has user_id
    usernameSpan.textContent = user.username;

    // Highlight if it's the current user
    if (user.user_id === this.currentUser.user_id) {
      usernameSpan.classList.add("is-self");
      usernameSpan.textContent += " (you)";
    }
    return userLi;
  }
}

// --- END OF FILE js/roomManager.js ---