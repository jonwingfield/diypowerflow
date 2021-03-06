//*********************
// BASIC configuration
const mqtt_host = "localhost";
// const influx_host = "localhost";

//**********************************************
// Solar prediction configuration
// for this to work, you must enter correct values for your location and panel configuration
const latitude = 28.5;
const longitude = -82.3;
const msl = 37; // Mean sea level (in meters)
//
const panels_cfg = [
  // azimuth: in degrees (direction along the horizon, measured from south to west), e.g. 0 is south and 90 is west
  // angle: angle the panels are facing relative to the horizon in degrees, e.g. 0 they are vertical, 90 they are flat
  // wattPeak: the Wp of the panels
  {
    name: 'Roof',
    azimuth: 0,
    angle: 80,
    wattPeak: 300
  }
];
// API key for darksky.net, in order to use aditionally forecasr from darksky.net you need to get and enter an API key
const darkskyApi = process.env.DARKSKY_API_KEY || '';

// the final calculated prediction will use weighted average from yr and darksky
// these are the weights for each forecast service, the sum should be 1.0
// adjust to fit which service better forecasts your location
//
const yr_weight = 0.6;
const darsksky_weight = 0.4;


//**************************************************
// Influx kWh queries
// const timezone = "Europe/Warsaw";
// const house_kwh_query = "SELECT sum(kwh) as kwh FROM energy WHERE (device = 'house' OR device= 'house2') AND time > now() - 1d GROUP BY time(1d) fill(0) TZ('"+timezone+"')";
// const grid_kwh_query = "SELECT sum(kwh) as kwh FROM energy WHERE (device = 'sdm120') AND time > now() - 1d GROUP BY time(1d) fill(0) TZ('"+timezone+"')";
// const solar_kwh_query = "select sum(wh)/1000 as kwh from (select watt/60 as wh from(SELECT MEAN(charging_power) as watt FROM pcm_query_general_status WHERE time > now() - 1d GROUP BY time(60s) fill(null) TZ('"+timezone+"') )) group by time(1d) fill(0) TZ('"+timezone+"')";
// const powerwall_soc_query = "SELECT last(ShuntSOC) FROM generic";

//**************************************************
// MQTT watt topics
const house_watt_topic = 'house/watt';
const house_kwh_topic = 'house/kwh';
const house2_watt_topic = 'house2/watt';
const grid_watt_topic = 'grid/watt';
const powerwall_watt_topic = 'powerwall/watt';
const powerwall_percent_topic = 'powerwall/percent';
const solar_watt_topic = "solar/watt";
const solar_kwh_topic = "solar/kwh";

//**************************************************
//**************************************************

const express = require('express');
const app = express();

const diy_sun = require('./diy_sun');

const mqtt = require('mqtt');
const mqtt_client = mqtt.connect('mqtt://'+mqtt_host);

// const Influx = require('influx');
// const influx = new Influx.InfluxDB({
//   host: influx_host,
//   database: 'powerwall'
// });

// const influx_batrium = new Influx.InfluxDB({
//   host: influx_host,
//   database: 'batrium'
// });


var moment = require('moment');
var schedule = require('node-schedule');


var house = 0;
var house2 = 0;
var grid = 0;
var powerwall = 0;
var solar = 0;
var solar_prediction = 0;
var solar_prediction_dayOffset = 0;

var server = require('http').createServer(app);
var io = require('socket.io')(server);
var SunCalc = require('suncalc');

function emitSolarPrediction() {
  prefix = "";

  if (solar_prediction_dayOffset>0) {
    prefix = "tomorrow ";
  }

  io.emit('solar prediction', { message: "("+prefix+"prediction "+solar_prediction.toPrecision(2)+" kWh)" });
}

function calculateSolarPrediction() {
  return diy_sun.solar_prediction_kwh( panels_cfg, solar_prediction_dayOffset, latitude, longitude, msl, darkskyApi, yr_weight, darsksky_weight);
}

// schedule every night to recalculate solar prediction for current day and schedule a job for the sunset

var j1 = schedule.scheduleJob('0 2 * * *', function(){

  solar_prediction_dayOffset = 0;
  solar_prediction = calculateSolarPrediction();
  emitSolarPrediction();

  var j2 = schedule.scheduleJob(moment(SunCalc.getTimes(moment(), latitude,longitude).sunset).toDate(), function(){
    // at sunset recalculate solar prediction for tomorrow
    solar_prediction_dayOffset = 1;
    solar_prediction = calculateSolarPrediction();
    emitSolarPrediction();
  });

});


console.log("Calculating solar prediction");
solar_prediction_dayOffset = moment().isAfter(moment(SunCalc.getTimes(moment(), latitude,longitude).sunset))? 1 : 0;
solar_prediction = calculateSolarPrediction();

io.on('connection', function(){
  //    console.log("NEW CONNECTION sending all values on start");
  if (house > 0 || house2 > 0) {
    io.emit('house', { message: house+house2 });
  }
  if (powerwall != 0) {
    io.emit('powerwall', { message: powerwall });
  }
  if (grid != 0) {
    io.emit('grid', { message: grid });
  }
  if (solar > 0) {
    io.emit('solar', { message: solar });
  }
  if (solar_prediction > 0) {
    emitSolarPrediction();
  }
});

mqtt_client.on('connect', () => {
  //  console.log("MQTT connected");
  mqtt_client.subscribe(house_watt_topic);
  mqtt_client.subscribe(house_kwh_topic);
  mqtt_client.subscribe(house2_watt_topic);
  mqtt_client.subscribe(grid_watt_topic);
  mqtt_client.subscribe(powerwall_watt_topic);
  mqtt_client.subscribe(powerwall_percent_topic);
  mqtt_client.subscribe(solar_watt_topic);
  mqtt_client.subscribe(solar_kwh_topic);
});

mqtt_client.on("close",function(error){
  console.log("mqtt can't connect"+error);
  io.emit('house', { message: 0 });
  io.emit('grid', { message: 0 });
  io.emit('powerwall', { message: 0 });
  io.emit('solar', { message: 0 });
});

let solar_kwh = 0.0;
let house_kwh = 0.0;
let powerwall_percent = 0.0;
let powerwall_v = 0.0;
let solar_watt_history = [];

mqtt_client.on('message', (topic, message) => {
  if(topic === house_watt_topic) {
    house = parseInt(message.toString());
    io.emit('house', { message: house+house2 });
  } else
    if(topic === house_kwh_topic) {
      house_kwh = parseFloat(message.toString());
    } else
    if(topic === powerwall_watt_topic) {
      powerwall = parseInt(message.toString());
      io.emit('powerwall', { message: powerwall });
    } else
    if(topic === powerwall_percent_topic) {
      var v, percent;
      [percent, v] = message.toString().split(',');
      powerwall_v = parseFloat(v.trim()).toFixed(2);
      powerwall_percent = Math.round(parseFloat(percent.trim()));
    } else
    if(topic === grid_watt_topic) {
      grid = parseInt(message.toString());
      io.emit('grid', { message: grid });
    } else
    if(topic === house2_watt_topic) {
      house2 = parseInt(message.toString());
      io.emit('house', { message: house+house2 });
    } else
    if(topic === solar_watt_topic) {
      solar = Math.round(parseFloat(message.toString()));
      solar_watt_history.push(solar);
      if (solar_watt_history.length > 60*30) {
        solar_watt_history.shift();
      }
      io.emit('solar', { message: solar });  
      io.emit('powerwall', { message: solar - house });
    } else
    if (topic === solar_kwh_topic) {
      solar_kwh = parseFloat(message.toString());
    }
});

app.get('/energy', function (req, res) {
  // influx.query(house_kwh_query).then( house => {
  //   influx.query(grid_kwh_query).then ( grid => {
  //     influx.query(solar_kwh_query).then ( solar => {
  const grid = [{},{kwh: 0}];
  const house = [{},{kwh: house_kwh}];
  const solar = [{},{kwh: solar_kwh}];

  res.json(
    [
      {"name":"grid kwh","value": (grid === undefined || grid.length == 0)? 0 : grid[1].kwh},
      {"name":"house kwh","value":house[1].kwh},
      {"name":"solar kwh","value":solar[solar.length -1].kwh},
      {"name":"solar watt history","value":solar_watt_history}
    ]
  );
      // });
    // });
  // });
});

app.get('/soc', function (req, res) {
  // influx_batrium.query(powerwall_soc_query).then( soc => {
    res.json(
      [
        {"name":"powerwall soc","value": powerwall_percent + "% (" + powerwall_v + "V)" }
      ]
    );
  // });
});


app.use(express.static('static'));

server.listen(3333, () => console.log('DIY powerflow listening on port 3333!'));

