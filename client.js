const { io } = require('socket.io-client');

const socket = io('ws://localhost:8005', {
   path: '',
   transports: ['websocket'],
   auth: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsYW5ndWFnZSI6ImVuIiwiZW1haWwiOiJuYW1yYXRhLmR1ZGhhdEBuZXhpb3MuaW4iLCJpZCI6MTAyMywiZGV2aWNlX2lkIjoiY2tnVGh4WVBTcHltQVowZGJ4MEo3czpBUEE5MWJFaXpNYlBGNEo3Nnd1R0JkWlRqY09LdW1rMzYzanJ1ZHZjQkNHQkFfeDhwLWQ4MGFWanpYOXV5QlBiZW1ra19tOUVxeS1NWXRmZ2xqbTRwcUdyLVdkdDV3WThscTRNUlFQdUR0dHNJVHRjUHBDdU1ZSSIsImFkbWluX2dyb3VwIjoic3RhZmYiLCJpYXQiOjE3NDg5NDU3ODR9.xlFzqYkbBZkOKGrC_LJCkuOIwk7Hq4E4XnAS5WaXkI4'
   }
});

socket.on('connect', () => {
   console.log('Connected', socket.id);

   socket.emit('register-auction', { auctionId: 'auction001' });

   setTimeout(() => {
      socket.emit('bid', {
         auctionId: 'auction001',
         bidAmount: 103000
      });
   }, 1000);
});

socket.on('new-bid', (data) => {
   console.log('New Bid Received:', data);
});
socket.on('bid', (data) => {
   console.log('New Bid Received:', data);
});

socket.on('disconnect', (reason) => {
   console.log('Disconnected:', reason);
});


socket.on('end-auction', (data) => {
   console.log('end auction event:', data);
});

socket.on('final-bid', (data) => {
   console.log('final-bid event:', data);
});