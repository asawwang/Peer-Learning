
console.log(localStorage);

if (!localStorage.getItem('display_name') && !localStorage.getItem('current_channel') && !localStorage.getItem('comment_stack') ) {
    var username = "admin" ;
    localStorage.setItem('display_name', username);
    localStorage.setItem('current_channel', JSON.stringify({}));
    localStorage.setItem('comment_stack', JSON.stringify({}));
    console.log("local storage reset: ", localStorage);
}

function getCurrentCrn() {
    var crn = document.getElementById('crn').textContent;
    if (crn!=previousCrn) {
        previousCrn = crn;
        var current_channel = JSON.parse(localStorage.getItem('current_channel'));
        current_channel[crn] = 'general';
        console.log("setting current channel", current_channel);
        console.log(typeof current_channel);
        localStorage.setItem('current_channel', JSON.stringify(current_channel));
    }
    return crn;
}

var previousCrn = "default";
const template = Handlebars.compile(document.querySelector('#load-messages').innerHTML);
const template_title = Handlebars.compile(document.querySelector('#load-channel-title').innerHTML);

// Load current value of display_name
document.addEventListener('DOMContentLoaded', () => {

    // Connect to a web-socket. Used for sending and recieving messages dynamically
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    // Get existing display name from local storage and display on site
//    var username = localStorage.getItem('display_name');
//    document.querySelector('#user').innerHTML = username;

    var current_channel_map = JSON.parse(localStorage.getItem('current_channel'));
    var crn = getCurrentCrn();
    if (!(crn in current_channel_map)) {
        current_channel_map[crn] = 'general';
    }
    const channel_to_display = template_title({'channel_to_display': current_channel_map[crn]});
    var channel_element = channel_to_display, parser = new DOMParser(), doc = parser.parseFromString(channel_element, 'text/xml');
    document.querySelector('#message-view').prepend(doc.querySelector('#channel-title'));

    function asynch_load_messages(request, refresh) {
        /*
        Parse JSON message data response from server. This functionality is used to generate the proper message view
        when the user refreshes the page, or switches channels.
        */
        console.log("[asynch_load_messages]", request)
        const data = JSON.parse(request.responseText);
        for(var i = 0; i < data.length; i++) {
            const comment = template({'comment': data[i]});
            document.querySelector('#comment-list').innerHTML += comment;
        }
        let comment_stack = JSON.parse(localStorage.getItem('comment_stack'));
        let crn = getCurrentCrn();
        if (!(crn in comment_stack)) {
            comment_stack[crn] = {'general': 110};
        }
        if (!(crn in current_channel_map)) {
            current_channel_map[crn] = 'general';
        }
        document.querySelector('#comment-list').style.paddingTop = `${comment_stack[crn][current_channel_map[crn]]}%`;
        var comment_count = document.querySelector('#comment-list').childElementCount;
        if (comment_count > 0) {
            document.querySelector('#comment-list').lastElementChild.scrollIntoView();
        }

        if(refresh) {
            document.querySelectorAll('#submit-switch-channel').forEach(button => {
                if(button.value == current_channel_map[crn]) {
                    button.parentElement.style.backgroundColor = '#333333';
                    button.firstElementChild.style.color = '#e3e8db';
                }
            });
        }

        return false;
    }

    function channel_switch() {
        /* Assign this function to button.onclick attribute. It the wrapper function for switching rooms.
        */

        console.log(this.value);

        // Clear messages from current view when switching to next channel
        var current_channel_map = JSON.parse(localStorage.getItem('current_channel'));
        var crn = getCurrentCrn();
        if (!(crn in current_channel_map)) {
            current_channel_map[crn] = 'general';
        }
        var room_to_leave = current_channel_map[crn];
        if(this.value != room_to_leave) {
            var current_channel = this.value;
            var current_user = localStorage.getItem('display_name');

            document.querySelectorAll('#submit-switch-channel').forEach(button => {
                if(button.value == current_channel) {
                    button.parentElement.style.backgroundColor = '#333333';
                    button.firstElementChild.style.color = '#e3e8db';
                }
                else if(button.value == room_to_leave) {
                    button.parentElement.style.backgroundColor = '#333333';
                    button.firstElementChild.style.color = '#e3e8db';
                }
            });

            socket.emit('join', current_channel);
            //socket.emit('leave', room_to_leave);

            current_channel_map[crn] = current_channel;
            console.log("setting current channel, ", current_channel_map)
            localStorage.setItem('current_channel', JSON.stringify(current_channel_map));
            document.querySelector('#comment-list').innerHTML = '';

            // Generate message view with data from server for user switching to a new channel
            const request = new XMLHttpRequest();
            request.open('POST', '/chatroom/'+getCurrentCrn());
            request.onload = asynch_load_messages.bind(null, request, refresh=false);
            const data = new FormData();
            data.append('channel_name', current_channel);
            console.log("posting from channel_switch", data);
            document.querySelector('#channel-title').innerHTML = current_channel;
            request.send(data);
            return false;

        }
        else {
            return false;
        }
    }

    function prevent_blank_text_entry(input_id, button_id) {
        /* Disable button by default, only enable if character entered in field */
        document.querySelector(button_id).disabled = true;

        document.querySelector(input_id).onkeyup = () => {
            if(document.querySelector(input_id).value.length > 0) {
                document.querySelector(button_id).disabled = false;
            }
            else {
                document.querySelector(button_id).disabled = true;
            }
        };
    }

    // Generate message view for user with data from server
    const request = new XMLHttpRequest();
    request.open('POST', '/chatroom/'+getCurrentCrn());;
    request.onload = asynch_load_messages.bind(null, request, refresh=true);
    const data = new FormData();
    data.append('username', username);
    var current_channel_map = JSON.parse(localStorage.getItem('current_channel'));
    var crn = getCurrentCrn();
    if (!(crn in current_channel_map)) {
        current_channel_map[crn] = 'general';
    }
    var current_channel = current_channel_map[crn];
    data.append('channel_name', current_channel_map[crn]);
//    console.log("posting from generating msg view", current_channel);
    request.send(data);

    // When connected to socket, configure send message button, and emit message_data to FLASK server
    socket.on('connect', () => {
        var current_channel_map = JSON.parse(localStorage.getItem('current_channel'));
        var crn = getCurrentCrn();
        if (!(crn in current_channel_map)) {
            current_channel_map[crn] = 'general';
        }
        var current_channel = current_channel_map[crn];
       socket.emit('join', current_channel);

       document.querySelectorAll('#submit-switch-channel').forEach(button => {
            button.onclick = channel_switch;
        });

       prevent_blank_text_entry('#message-input', '#submit-send-message');
       document.querySelector('#submit-send-message').onclick = () => {
           /* Event for any message being sent */

           var message_content = document.querySelector('#message-input').value
           var timestamp = new Date();
           timestamp = timestamp.toLocaleString('en-US');
           var user = username;
           var current_channel_map = JSON.parse(localStorage.getItem('current_channel'));
           var crn = getCurrentCrn();
            if (!(crn in current_channel_map)) {
                current_channel_map[crn] = 'general';
            }
           var current_channel = current_channel_map[crn];
           var delete_channel = `command delete ${current_channel}`;

           /* Superuser can delete a channel */
           if( (user == 'superuser') && (message_content == delete_channel) && (current_channel != 'general') )
           {
               user = "mod";
               message_content = `mod has deleted channel ${current_channel}`;
               let message_data = {"crn": getCurrentCrn(), "message_content": message_content, "timestamp": timestamp, "user":user, "current_channel": current_channel };

               console.log(message_data);
               document.querySelector('#message-input').value = '';
               socket.emit('delete channel', message_data);
               document.querySelector('#submit-send-message').disabled = true;

               return false;

           }
           else {
               if(user == 'superuser') {
                   user = 'mod';
               }
               let message_data = {"crn": getCurrentCrn(), "message_content": message_content, "timestamp": timestamp, "user":user, "current_channel": current_channel };
               console.log(message_data);
               document.querySelector('#message-input').value = '';
               socket.emit('send message', message_data);
               document.querySelector('#submit-send-message').disabled = true;

               return false;
           }
       };

    });

    // When a message is broadcast to a channel, recieve the message, and add it to the message view
    socket.on('receive message', message_data => {
    // NOTE: current_channel is not set properly when switching channels
        if (message_data["crn"]!= getCurrentCrn()) { // || message_data["current_channel"]!=current_channel) {
            console.log("message is not for current course or channel.", getCurrentCrn(), current_channel);
            console.log(message_data);

            return;
        }

        // Create a comment element and add to message view

        const li = document.createElement('li');
        li.setAttribute('class', 'media comment-item');

        const div_media_body = document.createElement('div');
        div_media_body.setAttribute('class', 'media-body comment-media');

        const h5 = document.createElement('h5');
        h5.setAttribute('class', 'mt-0 mb-1 comment-user');
        let midpt = '&middot';
        let space = '\u0020';
        h5.innerHTML = `${message_data["user"]}${space}${midpt}${space}`;

        const div_time = document.createElement('div');
        div_time.setAttribute('class', 'comment-time');
        div_time.setAttribute('id', 'time');
        div_time.innerHTML = message_data["timestamp"];

        const div_comment = document.createElement('div');
        div_comment.setAttribute('class', 'comment-comment');
        div_comment.innerHTML = message_data["message_content"];

        div_media_body.appendChild(h5);
        div_media_body.appendChild(div_time);
        div_media_body.appendChild(div_comment);

        li.appendChild(div_media_body);

        document.querySelector('#comment-list').append(li);
        if(!message_data['deleted_message']) {
            let comment_stack = JSON.parse(localStorage.getItem('comment_stack'));
            let crn = getCurrentCrn();
            if (!(crn in comment_stack)) {
                comment_stack[crn] = {'general': 110};
            }
            let current_channel_map = JSON.parse(localStorage.getItem('current_channel'));
            if (!(crn in current_channel_map)) {
                current_channel_map[crn] = 'general';
            }
            var current_channel = current_channel_map[crn];
            comment_stack[crn][current_channel] -= 10;
            localStorage.setItem('comment_stack', JSON.stringify(comment_stack));
            document.querySelector('#comment-list').style.paddingTop = `${comment_stack[getCurrentCrn()][current_channel]}%`;
        }
        li.scrollIntoView();
    });

//    socket.on('announce channel deletion', message_data => {
//        var deleted_channel = message_data["deleted_channel"];
//        message_data = message_data["data"];
//        socket.emit('join', 'general');
//        socket.emit('leave', deleted_channel);
//
//        document.querySelector('#comment-list').innerHTML = '';
//        document.querySelector('#channel-title').remove();
//
//        var comment_stack = JSON.parse(localStorage.getItem('comment_stack'));
//        delete comment_stack[getCurrentCrn()][deleted_channel];
//        localStorage.setItem('comment_stack', JSON.stringify(comment_stack));
//        document.querySelectorAll('#submit-switch-channel').forEach(button => {
//            if(button.value == deleted_channel) {
//                button.parentElement.remove();
//            }
//            else if(button.value == localStorage.getItem('current_channel')) {
//                button.parentElement.style.backgroundColor = '#333333';
//                button.firstElementChild.style.color = '#e3e8db';
//            }
//        });
//        localStorage.setItem('current_channel', 'general');
//        document.querySelectorAll('#submit-switch-channel').forEach(button => {
//            if(button.value == localStorage.getItem('current_channel')) {
//                button.parentElement.style.backgroundColor = '#e3e8db';
//                button.firstElementChild.style.color = '#333333';
//            }
//        });
//
//        const channel_to_display = template_title({'channel_to_display': localStorage.getItem('current_channel')});
//        var channel_element = channel_to_display, parser = new DOMParser(), doc = parser.parseFromString(channel_element, 'text/xml');
//        document.querySelector('#message-view').prepend(doc.querySelector('#channel-title'));
//
//        var data = message_data;
//        for(var i = 0; i < data.length; i++) {
//            const comment = template({'comment': data[i]});
//            document.querySelector('#comment-list').innerHTML += comment;
//        }
//        let crn = getCurrentCrn();
//        if (!(crn in comment_stack)) {
//            comment_stack[crn] = {'general': 110};
//        }
//        document.querySelector('#comment-list').style.paddingTop = `${comment_stack[crn][localStorage.getItem('current_channel')]}%`;
//        var comment_count = document.querySelector('#comment-list').childElementCount;
//        if (comment_count > 0) {
//            document.querySelector('#comment-list').lastElementChild.scrollIntoView();
//        }
//    });

    // Set onsubmit attribute for adding channel
    prevent_blank_text_entry('#channel', '#submit-add-channel');
    document.querySelector('#add-channel-form').onsubmit = () => {
        const channel_name = document.querySelector('#channel').value;
        var comment_stack = JSON.parse(localStorage.getItem('comment_stack'));
        let crn = getCurrentCrn();
        if (!(crn in comment_stack)) {
            comment_stack[crn] = {'general': 110};
        }
        if( !(channel_name in comment_stack[crn]) ) {

            socket.emit('create channel', channel_name);

            // Save comment stack padding on all clients
            socket.on('new channel', new_channel => {
                var comment_stack = JSON.parse(localStorage.getItem('comment_stack'));
               let crn = getCurrentCrn();
                if (!(crn in comment_stack)) {
                    comment_stack[crn] = {'general': 110};
                }
                comment_stack[crn][new_channel] = 110;
                localStorage.setItem('comment_stack', JSON.stringify(comment_stack));
            });

            // Create channel which is a form->button->li nested element,
            // Assume request is good and add to front-end for quicker response
            // If request turns out to be bad, remove the added channel UI in onload
            const form = document.createElement('form');
            form.setAttribute('id', 'switch-channel-form');

            const button = document.createElement('button');
            button.id = 'submit-switch-channel';
            button.setAttribute('type', 'submit');
            button.setAttribute('value', channel_name);
            button.onclick = channel_switch;

            const li = document.createElement('li');
            li.innerHTML = `# ${channel_name}`;
            li.setAttribute('id','channel-option');

            button.appendChild(li);
            form.appendChild(button);
            console.log(form);
            document.querySelector('#channels').append(form);

            document.querySelector('#channel').value = '';
            document.querySelector('#submit-add-channel').disabled = true;

            // send Asynch AJAX request to POST channel data to FLASK server
            const request = new XMLHttpRequest();
            request.open('POST', '/chatroom/'+getCurrentCrn());

            // Ensure response is OK, and sending data was succusful
            request.onload = () => {
                const data = JSON.parse(request.responseText);
                if(data.success) {
                    console.log("Keeping added channel UI clientside");
                }
                else {
                    console.log("Server did not process request to add new channel, deleting channel UI");
                    document.querySelector('#channels').lastElementChild.remove();
                }
            }

            const data = new FormData();
            data.append('channel_name', channel_name);
            request.send(data);

            return false;

        }
        else {
            document.querySelector('#channel').value = '';
            document.querySelector('#submit-add-channel').disabled = true;
            alert("Channel already exists");
            return false;
        }
    };

});
