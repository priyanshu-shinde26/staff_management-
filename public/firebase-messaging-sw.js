importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDgqKxRv4DoIRDKY_A4pTzet66Dp8ICLr0',
  authDomain: 'maa-bhawani-catering.firebaseapp.com',
  databaseURL: 'https://maa-bhawani-catering-default-rtdb.firebaseio.com/',
  projectId: 'maa-bhawani-catering',
  storageBucket: 'maa-bhawani-catering.firebasestorage.app',
  messagingSenderId: '816368894543',
  appId: '1:816368894543:web:1e5792d112f80c50fd603a',
  measurementId: 'G-Z3NGRCTL70'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'New Assignment';
  const options = {
    body: payload?.notification?.body || 'You have a new shift assignment.',
    data: payload?.data || {},
    icon: '/vite.svg'
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
