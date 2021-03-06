var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var socket = require('socket.io-client');
var path = require('path');
var fs = require('fs');
var noble = require('noble');
var internalIp = require('internal-ip');
var publicIp = require('public-ip');

var isConnectSocket = false;
var reScan = false;
var isWrite = false;
var isRead = false;

var serial_number = 'CCC'; 
// var serial_number = fs.readFileSync("/proc/cpuinfo").toString().split("Serial\t\t: ")[1].trim() || "dummy-not-pi";

var peripheral_action = {};

//var domain = "192.168.21.127";
var domain = "http://localhost:9000";
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

  if (peripheral_action && peripheral_action.serial_number == peripheral.uuid) {
    console.log("match uuid");
    noble.stopScanning();
    peripheral.connect();
    explore(peripheral);
  } else {
    socket.emit("pi:receive", sendData);  
  }
});

noble.on('scanStop', function() {
  if (reScan) {
		reScan = false;
    console.log('Start rescan');
    noble.startScanning();
	}

});

function explore(peripheral) {

  peripheral.on('connect', function() {
    console.log('on -> connect');
    this.updateRssi();
  });

  peripheral.on('disconnect', function() {
    console.log('on -> disconnect');
    peripheral.removeAllListeners('connect');
    peripheral.removeAllListeners('disconnect');
    peripheral.removeAllListeners('rssiUpdate');
    peripheral.removeAllListeners('servicesDiscover');

  });

  peripheral.on('rssiUpdate', function(rssi) {
    console.log('on -> RSSI update ' + rssi);
    this.discoverServices(['ffe0']);
  });

  peripheral.on('servicesDiscover', function(services) {
    console.log('on -> peripheral services discovered ' + services);


    var serviceIndex = 0;

    services[serviceIndex].on('includedServicesDiscover', function(includedServiceUuids) {
      console.log('on -> service included services discovered ' + includedServiceUuids);
      this.discoverCharacteristics(['ffe1']);
    });

    services[serviceIndex].on('characteristicsDiscover', function(characteristics) {
      console.log('on -> service characteristics discovered ' + characteristics);

        // characteristics[0].write(new Buffer([0x32]), false, function(error) {
        //   console.log('write 0x32');
        // });
      var characteristicIndex = 0;

      characteristics[characteristicIndex].on('read', function(data, isNotification) {
        console.log('on -> characteristic read ' + data + ' ' + isNotification);
        console.log(data);

        // peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('write', function() {
        console.log('on -> characteristic write ');

        peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('broadcast', function(state) {
        console.log('on -> characteristic broadcast ' + state);

        // peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('notify', function(state) {
        console.log('on -> characteristic notify ' + state);

        // peripheral.disconnect();
      });

      characteristics[characteristicIndex].on('descriptorsDiscover', function(descriptors) {
        console.log('on -> descriptors discover ' + descriptors);

        var descriptorIndex = 0;
        console.log(descriptors);

        //descriptors[descriptorIndex].on('valueRead', function(data) {
        //  console.log('on -> descriptor value read ' + data);
        //  console.log(data);
        //  // peripheral.disconnect();
        //});

  //        descriptors[descriptorIndex].on('valueWrite', function() {
  //         console.log('on -> descriptor value write ');
          // peripheral.disconnect();
  //      });

        //descriptors[descriptorIndex].readValue();
        //descriptors[descriptorIndex].writeValue(new Buffer([0]));
      });


      // characteristics[characteristicIndex].read();
      characteristics[characteristicIndex].write(new Buffer(peripheral_action.data));
      //characteristics[characteristicIndex].broadcast(true);
      // characteristics[characteristicIndex].notify(true);
      // characteristics[characteristicIndex].discoverDescriptors();
      //peripheral.disconnect();
    });


    services[serviceIndex].discoverIncludedServices();
  });
}

///////////////////////
///////////////////////
///////////////////////

socket.on('pi:schedule:' + serial_number, function(pi) {
  writeJSONFile(JSON.stringify(pi), 'schedule');


  require('crontab').load(function(err, crontab) {
    if (err) {
      return console.error(err);
    }

    // TO DO in scdule
    for (var i = 0; i < pi.devices.length; i++) {
      var device = pi.devices[i];
      device.schedule.forEach(function(schedule) {
        console.log(device.uuid)
        console.log(schedule)

        // do cron tab
        var command = 'ls -l';

        crontab.remove({command:command});
        crontab.create(command, '@reboot');

        crontab.save(function(err, crontab) {
          if (err) {
            console.log(err)
          } else {
            console.log('save crontab')
            console.log(crontab)

          }
        });

      });
    };

  });
  




});

///////////////////////
///////////////////////
///////////////////////

socket.on('pi:action:bleWrite:' + serial_number, function(data) {
  peripheral_action = data;
  reScan = true;
  noble.stopScanning();
  console.log('write peripheral:' + peripheral_action.serial_number + " with data:" + data.data);
});

socket.on('pi:action:bleReScan:' + serial_number, function(data) {
  console.log('re scan');
  peripheral_action = {};
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


setInterval(function() {

  publicIp(function (err, ip) {

    var sendIpData = 
    {
      type: "ip",
      data: internalIp()
    }

    socket.emit('pi:receive', sendIpData)

  });

  var sendLocalIpData = 
  {
    type: "localIp",
    data: internalIp()
  }

  socket.emit('pi:receive', sendLocalIpData)


}, 5000);


  ////////////////////////////
 /////// write data /////////
////////////////////////////


var writeJSONFile = function (data, name) {

  var filePath = path.join(__dirname, '/data/') + name + '.json' ;
  fs.writeFile(filePath, data, function(err) {
      if(err) {
          console.log(err);
      } else {
          console.log("The file was saved!");
      }
  }); 
}

var readJSONFile = function (name, callback) {

  var filePath = path.join(__dirname, '/data/') + name + '.json' ;
  fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        console.log('Error: ' + err);
        callback(err, null);
      } else {
        data = JSON.parse(data);
        callback(null, data);
      }

      console.dir(data);
    });
}

var writeFile = function (data) {

  var filePath = path.join(__dirname, '/data/') + 'SENSOR-ble' ;
  fs.writeFile(filePath, data, function(err) {
      if(err) {
          console.log(err);
      } else {
          console.log("The file was saved!");
      }
  }); 
}

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
