const mmss = new Intl.DateTimeFormat('en-US', { minute: '2-digit', second: '2-digit' }).format;

let _session = null;

let _clocks = {};
let _timers = {};
let _elapsed = {};

async function run(selector) {

    _session = await connectToDiffusion();
    if(! _session) {
        alert("Unable to connect to Diffusion");
        return;
    }
    
    _session.addStream(selector, diffusion.datatypes.json())
        .on("value", onUpdateClock);

    _session.select(selector);
}

async function connectToDiffusion() {
    let p = new Promise((resolve, reject) => {
        diffusion.connect({
            principal: "control",
            credentials: "password",
            secure: false
        }).then(
            (session) => {
                resolve(session);
            },
            (err) => {
                console.log("err", err);
                resolve(null);
            });
    });

    return p;
}

function onUpdateClock(topic, spec, newValue, oldValue) {
    let clock = newValue.get();

    _clocks[topic] = clock;

    // Synchronize with our clock
    if(clock.running) {
        let now = new Date().getTime();
        _elapsed[topic] = now
            - (clock.last_update_time || 0)
            + (clock.period[clock.active_period].elapsed_time || 0);

        startTimer(topic);
    }
    else {
        if(clock.active_period !== null) {
            _elapsed[topic] = clock.period[clock.active_period].elapsed_time || 0;
        }
        else {
            _elapsed[topic] = 0;
        }

        stopTimer(topic);
    }

    displayClock(topic);
}

function displayClock(id) {
    let elem = document.getElementById("event-clock-" + id);
    if(! elem) {
        elem = uiAddClock(id);
        document.getElementById("clocks").appendChild(elem);
    }

    let arr = id.split("/");
    let [sport, event] = arr.slice(arr.length - 2);

    let clock = _clocks[id];
    let period = clock.period[clock.active_period];

    // elem.querySelector(".sport").innerText = sport;
    elem.querySelector(".event").innerText = event;

    let time;
    if(! period) {
        if(clock.count_down) {
            time = clock.period[0].duration * 1000;
        }
        else {
            time = 0;
        }
    }
    
    if(period) {
        if(clock.count_down) {
            time = (period.duration * 1000) - _elapsed[id];
        }
        else {
            time = _elapsed[id];
        }
    }
    elem.querySelector(".clock").innerText = mmss(time);

    let txt = "Match not started";
    if(clock.actual_stop_time) {
        txt = "Match finished";
    }
    else if(period) {
        txt = period.name;
    }
    let elemPeriod = elem.querySelector(".period").innerText = txt;
}

function uiAddClock(id) {
    let elem = document.getElementById("clock-template").content.cloneNode(true).children[0];
    elem.id = "event-clock-" + id;

    return elem;
}


function startTimer(id) {
    if(! (_timers[id] === null || _timers[id] === undefined)) {
        return;
    }

    if(! _elapsed[id]) {
        _elapsed[id] = 0;
    }

    _timers[id] = window.setInterval(() => {
        _elapsed[id] += 1000;

        // Check if auto_stop is set, and stop timer if so
        let clock = _clocks[id];
        if(clock.period[clock.active_period].auto_stop
           && _elapsed[id] >= (clock.period[clock.active_period].duration * 1000)) {

            stopTimer(id);
            _elapsed[id] = clock.period[clock.active_period].duration * 1000;
        }
      
        displayClock(id);
    }, 1000);
}

function stopTimer(id) {
    if(_timers[id] === null || _timers[id] === undefined) {
        return;
    }

    window.clearInterval(_timers[id]);
    _timers[id] = null;

    return _elapsed[id];
}
