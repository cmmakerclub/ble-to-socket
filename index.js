var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var socket = require('socket.io-client');
var path = require('path');
var noble = require('noble');

var serial_number = 'BBB'; 

var isConnectSocket = false;

noble.on('stateChange', function(state) {

  if (!isConnectSocket) {
    return;
  }

  if (state === 'poweredOn') {
    console.log("Starting scan.");
    noble.startScanning();
  } else {
    console.log("Stopping scan.");
    noble.stopScanning();
  }
});

noble.on('discover', function(peripheral) {
  console.log("Peripheral discovered!")
  console.log("  Name: " + peripheral.advertisement.localName)
  console.log("  UUID: " + peripheral.uuid);

  socket.emit("pi:ble", peripheral.advertisement.localName + "," + peripheral.uuid);
});

socketClient.on('connect', function() {
  isConnectSocket = true;
  noble.startScanning();
});

socketClient.on('disconnect', function(){
  isConnectSocket = false;
  noble.stopScanning();
});
