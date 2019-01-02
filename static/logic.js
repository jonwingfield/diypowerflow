
// ---- configuration ------
var energy = "./energy";
var soc = "./soc";

var max_inactives_seconds = 180;

// feed names
var solar_kwh_name = "solar kwh";
var grid_kwh_name = "grid kwh";
var house_kwh_name = "house kwh";
var powerwall_soc_name = "powerwall soc";

//---------------------------------------------

var solar_watt = 0;
var solar_kwh = 0;
var grid_watt = 0;
var grid_kwh = 0;
var house_watt = 0;
var house_kwh = 0;
var powerwall_watt = 0;
var powerwall_soc = 0;
var solar_prediction = 0;

function loadValues(url) {
    $.getJSON(url, function(data){
        updateValues(data);
        refresh_ui();
    });
}

function updateValues(data) {
    var now = Math.round(new Date().getTime()/1000);

    for (var i = 0, len = data.length; i < len; i++) {
       // SOLAR
//       if (data[i].name == solar_watt_name) {
//         if(data[i].time + max_inactive_seconds >= now){
//            solar_watt = data[i].value
//         } else {
//            solar_watt = 0;
//         }
//       }
       if (data[i].name == solar_kwh_name) {
         solar_kwh = data[i].value;
       }
        // GRID
//       if (data[i].name == grid_watt_name) {
//         if(data[i].time + max_inactive_seconds >= now){
//             grid_watt = data[i].value;
//         } else {
//            grid_watt = 0;
//         }
//       }
       if (data[i].name == grid_kwh_name) {
         grid_kwh = data[i].value;
       }

        // HOUSE
//       if (data[i].name == house_watt_name) {
//         if(data[i].time + max_inactive_seconds >= now){
//             house_watt = data[i].value;
//         } else {
//            house_watt = 0;
//         }
//       }
       if (data[i].name == house_kwh_name) {
         house_kwh = data[i].value;
       }
        // POWERWALL
//       if (data[i].name == powerwall_watt_name) {
//         if(data[i].time + max_inactive_seconds >= now){
//            powerwall_watt = data[i].value;
//         } else {
//            powerwall_watt = 0;
//         }
//       }
       if (data[i].name == powerwall_soc_name) {
         powerwall_soc = data[i].value;
         if (powerwall_soc>100) {
           powerwall_soc=100;
        }
       }
    }
}

function electronTime(watt) {
    w = Math.abs(watt);
	//y = 0.03994327 + (6.608192 - 0.03994327)/(1 + (x/270.2608)^1.356501)
    if (w<50) {
        return 6;
    }
    if (w<200) {
        return 4;
    }
    if (w<500) {
        return 2
    }
    if (w<1000) {
        return 1;
    }
    if (w<2000) {
        return 0.5;
    }
    if (w < 3000) {
       return 0.25;
    }
    return 0.125;
}

function setAnimationTime(watt,selector1,selector2) {
    var time = electronTime(watt)+"s";

    $(selector1).each(function( index ) {
        if ($(this).attr("dur")!=time) {
            $(this).attr("dur",time);
        }
    });
   $(selector2).each(function( index ) {
        if ($(this).attr("begin")!=time) {
            $(this).attr("begin",time);
            $(this).attr("dur",time);
        }
    });
}

function formatEnergy(value) {
    value = parseFloat(value);
    if (value > 0) {
	    if (value >= 1.0) {
		    return value.toPrecision(2) + " kWh";
	    } else {
		    return Math.round(value * 1000) + " Wh";
	    }
    } else {
	    return value.toPrecision(1) + " kWh";
    }

}

function refresh_ui() {
    if (solar_watt>0) {
        $("#solar").addClass("on");
        $("#solar_watt").text(solar_watt+" w");
        $("#solar-line").addClass("on");
        $("#solar-dot").addClass("on");
    } else {
        $("#solar").removeClass("on");
        $("#solar-line").removeClass("on");
        $("#solar-dot").removeClass("on");
    }
    $("#solar_kwh").text(formatEnergy(solar_kwh));
    setAnimationTime(solar_watt,"#solar-dot animate.dot1","#solar-dot animate.dot2");

    if (grid_watt!=0) {
        $("#grid").addClass("on");
        $("#grid_watt").text(Math.round(grid_watt)+" w");
        $("#grid-line").addClass("on");
        if (grid_watt>0) {
            $("#grid-dot-out").addClass("on");
            $("#grid-dot-in").removeClass("on");
        } else {
            $("#grid-dot-in").addClass("on");
            $("#grid-dot-out").removeClass("on");
        }
    } else {
        $("#grid").removeClass("on");
        $("#grid-line").removeClass("on");
        $("#grid-dot-out").removeClass("on");
        $("#grid-dot-in").removeClass("on");
    }
    $("#grid_kwh").text(formatEnergy(grid_kwh));
    setAnimationTime(grid_watt,"#grid-dot-in animate.dot1, #grid-dot-out animate.dot1","#grid-dot-in animate.dot2, #grid-dot-out animate.dot2");

    if (house_watt>0) {
        $("#house").addClass("on");
        $("#house_watt").text(Math.round(house_watt)+" w");
        $("#house-line").addClass("on");
        $("#house-dot").addClass("on");
    } else {
        $("#house").removeClass("on");
        $("#house-line").removeClass("on");
        $("#house-dot").removeClass("on");
    }
    $("#house_kwh").text(formatEnergy(house_kwh));

    setAnimationTime(house_watt,"#house-dot animate.dot1, #house animate.glow","#house-dot animate.dot2");

    if (Math.abs(powerwall_watt)>2) {
        $("#powerwall").addClass("on");
        $("#powerwall_watt").text(Math.round(powerwall_watt)+" w");
        $("#powerwall-line").addClass("on");
        if (powerwall_watt>0) {
            $("#powerwall-dot-out").removeClass("on");
            $("#powerwall-dot-in").addClass("on");
        } else {
            $("#powerwall-dot-out").addClass("on");
            $("#powerwall-dot-in").removeClass("on");
        }
    } else {
        $("#powerwall").removeClass("on");
        $("#powerwall-line").removeClass("on");
        $("#powerwall-dot-out").removeClass("on");
        $("#powerwall-dot-in").removeClass("on");
    }
    $("#powerwall_soc").html(powerwall_soc.replace("(", "<small>(").replace(")", ")</small>"));

    setAnimationTime(powerwall_watt,"#powerwall-dot-in animate.dot1, #powerwall-dot-out animate.dot1, #powerwall animate.glow","#powerwall-dot-in animate.dot2, #powerwall-dot-out animate.dot2");

}

loadValues(energy);
loadValues(soc);

var socket;
if (window.location.host === 'jonwingfield.name') {
	socket = io.connect('/',  { path: "/energy/socket.io" });
} else {
	socket = io.connect('/');
}

socket.on('house', function(data) {
    house_watt = parseInt(data.message);
    refresh_ui();
});

socket.on('powerwall', function(data) {
    powerwall_watt = parseInt(data.message);
    refresh_ui();
});

socket.on('solar', function(data) {
    solar_watt = parseInt(data.message);
    refresh_ui();
});

socket.on("solar prediction", function(data){
    $("#solar_prediction").text(data.message);
});

var interval = setInterval(function() {
    loadValues(energy);
    loadValues(soc);
}, 30000);

