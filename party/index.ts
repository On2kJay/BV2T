(function initPartySync() {
            const PARTY_ROOM = 'bv2t-server';
            let partySocket = null;
            let reconnectAttempts = 0;
            
            function connectParty() {
                try {
                    console.log('Connecting to PartyKit...');
                    partySocket = new WebSocket(`wss://${PARTY_ROOM}.partykit.dev/party/${PARTY_ROOM}`);
                } catch (e) {
                    console.error('PartyKit connection error:', e);
                    setTimeout(connectParty, 3000);
                    return;
                }
                
                partySocket.onopen = () => {
                    console.log('Connected to PartyKit server');
                    reconnectAttempts = 0;
                };
                
                partySocket.onerror = (e) => {
                    console.error('PartyKit error:', e);
                };
                
                partySocket.onmessage = (ev) => {
                    try {
                        const msg = JSON.parse(ev.data);
                        if (msg.type !== 'sync' || !msg.data) return;
                        const data = msg.data;
                        
                        if (data.users) users = data.users;
                        if (data.globalMarket) globalMarket = data.globalMarket;
                        if (data.clans) clans = data.clans;
                        if (data.posts) communityPosts = data.posts;
                        if (data.news) newsFeedPosts = data.news;
                        if (data.chat) globalChatMessages = data.chat;
                        if (data.bannedUsers) bannedUsers = data.bannedUsers;
                        if (data.adminUsers) adminUsers = data.adminUsers;
                        if (data.globalLuckBoost) globalLuckBoost = data.globalLuckBoost;
                        if (data.onlinePresence) onlinePresence = data.onlinePresence;
                        
                        if (currentUser && users && users[currentUser]) {
                            upC();
                            updateMailBadge?.();
                            if (!document.getElementById('v-b')?.classList.contains('hidden')) renderI?.();
                            if (!document.getElementById('v-g')?.classList.contains('hidden')) renderG?.();
                            if (!document.getElementById('v-post')?.classList.contains('hidden')) renderPosts?.();
                            if (!document.getElementById('v-news')?.classList.contains('hidden')) renderNewsFeed?.();
                            if (!document.getElementById('v-c')?.classList.contains('hidden')) renderClans?.();
                            if (!document.getElementById('v-t')?.classList.contains('hidden')) renderT?.();
                            if (!document.getElementById('v-chat')?.classList.contains('hidden')) renderGlobalChat?.();
                            updateGlobalLuckUi?.();
                        }
                    } catch (_) {}
                };
                
                partySocket.onclose = () => {
                    console.log('PartyKit disconnected, reconnecting...');
                    reconnectAttempts++;
                    setTimeout(connectParty, Math.min(reconnectAttempts * 2000, 30000));
                };
            }
            
            window.partySync = (key, value) => {
                if (partySocket?.readyState === WebSocket.OPEN) {
                    partySocket.send(JSON.stringify({ type: 'update', key, value }));
                }
            };
            
            window.sendPartyChat = (from, body) => {
                if (partySocket?.readyState === WebSocket.OPEN) {
                    partySocket.send(JSON.stringify({ type: 'chat', from, body }));
                }
            };
            
            window.saveUserToServer = (name, data) => {
                if (partySocket?.readyState === WebSocket.OPEN) {
                    partySocket.send(JSON.stringify({ type: 'saveUser', name, ...data }));
                }
            };
            
            window.loadUserFromServer = (name) => {
                return new Promise((resolve) => {
                    if (partySocket?.readyState === WebSocket.OPEN) {
                        const handler = (ev) => {
                            try {
                                const msg = JSON.parse(ev.data);
                                if (msg.type === 'userData') {
                                    partySocket.removeEventListener('message', handler);
                                    resolve(msg.data);
                                }
                            } catch (_) {}
                        };
                        partySocket.addEventListener('message', handler);
                        partySocket.send(JSON.stringify({ type: 'getUser', name }));
                    } else {
                        resolve(null);
                    }
                });
            };
            
            connectParty();
        })();
        
        function syncBroadcast(changedKey) {
            if (window.partySync) {
                const keyMap = {
                    'blook_users': 'users',
                    'blook_global_market': 'globalMarket',
                    'blook_clans': 'clans',
                    'blook_posts': 'posts',
                    'blook_news': 'news',
                    'blook_global_chat': 'chat',
                    'blook_banned_users': 'bannedUsers',
                    'blook_admin_users': 'adminUsers',
                    'blook_global_luck_boost': 'globalLuckBoost',
                    'blook_online_presence': 'onlinePresence'
                };
                const serverKey = keyMap[changedKey] || changedKey;
                const data = { users, globalMarket, clans, posts: communityPosts, news: newsFeedPosts, chat: globalChatMessages, bannedUsers, adminUsers, globalLuckBoost, onlinePresence };
                window.partySync(serverKey, data[serverKey]);
            }
        }