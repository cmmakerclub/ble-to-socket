var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var socket = require('socket.io-client');
var path = require('path');
var fs = require('fs');
var noble = require('noble');

var isConnectSocket = false;
var reScan = false;
var serial_number = 'CCC'; 
//var domain = "192.168.21.127";
var domain = "http://192.168.21.127:9000";
//var domain = "https://derconnect.herokuapp.com";

//socket = socket.connect(domain, { path: '/socket.io-client'});
socket = socket.connect(domain, { path: '/socket.io-client', query: "from=raspberry&ble_scan=1&serial_number=" + serial_number });

noble.on('stateChange', function(state) {

  if (!isConnectSocket) {
    return;
  }

  if (state === 'poweredOn') {
    console.log("Starting scan.");
    //noble.startScanning();
  } else {
    console.log("Stopping scan.");
    //noble.stopScanning();
  }
});

noble.on('discover', function(peripheral) {
  console.log("Peripheral discovered!")
  console.log("  Name: " + peripheral.advertisement.localName)
  console.log("  UUID: " + peripheral.uuid);

	var sendData = 
  {
    type: "bleList",
    data: { name: peripheral.advertisement.localName, uuid: peripheral.uuid } 
  }

  socket.emit("pi:receive", sendData);

});

noble.on('scanStop', function() {
  if (reScan) {
		reScan = false;
    console.log('Start rescan');
    noble.startScanning();
	}

});

socket.on('pi:action:bleReScan:' + serial_number, function() {
  console.log('re scan');
  reScan = true;
  noble.stopScanning();
});

socket.on('connect', function() {
  console.log('connect');
  isConnectSocket = true;
  noble.startScanning();
});

socket.on('disconnect', function(){
  console.log('disconnect');
  isConnectSocket = false;
  noble.stopScanning();
});


  ////////////////////////////
 /////// read data //////////
////////////////////////////
setInterval(function() {

  fs.readdir(__dirname + '/data', function(err, files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i].split(",");
      var sn = "";
      var createAt = "";
      var sensorName = "";
      var sensorData = "";

      for (var j = 0; j < file.length; j++) {
        var data = file[j].split("-");
        if (data[0] == "SN") {
          sn = data[1];
        } else if (data[0] == "AT") {
          createAt = data[1];
        } else if (data[0] == "SENSOR") {
          sensorName = data[1];
        }
      }
        filePath = path.join(__dirname, '/data/' + files[i]);
        sensorData = fs.readFileSync(filePath, {encoding: 'utf-8'});

        if (sensorName && sensorName != '' ) {//&& sn != '' && createAt != '') {

          console.log('send data name ' + sensorName + ':' + sensorData);
          fs.unlinkSync(filePath);

          socket.emit('pi:receive', sensorName + "," + sensorData);

        }

    }
  });

}, 5000);
