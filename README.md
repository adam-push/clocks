# Efficient game clocks with Diffusion

## Introduction

This is a demonstration of how to implement a game clock efficiently in Diffusion.

A naïve approach to synchronising game time between the client and server is to send a message per tick, i.e. every second. While simple, this is inefficient at scale.

A more sophisticated approach is to only send the game time to the client when an event occurs that would cause the clock to change state, i.e. from stopped to running, and running to stopped. The client is responsible for calculating the current time based on notification of these state changes.

## Running the demo

You may wish to replace the `license.lic` file in the `Diffusion` directory with your own before building and running the demo.

```
docker-compose build && docker-compose up
```

Once running, point your web browser to `http://localhost:8080/demo`

Three links are found on this page:

### Control panel

Displays and manages all clocks. Allows an operator to start/stop a clock, move to the next period, set an explicit time, etc.

### Football client

Example of a client showing clocks for football (soccer) matches.

### Basketball client

Example of a client showing clocks for basketball matches. The clock counts down, rather than up.

## Clock definition

A sporting event is typically divided into multiple periods; in football (soccer) there are two halves, with the possibility of two halves of extra time (perhaps one, under "golden goal" rules). Basketball matches have 4 quarters, (ice) hockey has 3 periods, and so on. The duration of each period for any given sport may vary in different leagues or levels of competition.

Each sport may also have a different behaviour when the end of the period is reached. For basketball, the clock (which counts down) and period stops once the clock reaches zero. In football, the clock may continue indefinitely into injury time.

Clocks may also be paused during the game, and resume later.

We will model our game clock in JSON using the following example JSON. This JSON represents a basketball match.

```json
{
    "scheduled_start_time" : 1616755150883,
    "actual_stop_time"     : null,
    "running"              : false,
    "last_update_time"     : null,
    "active_period"        : null,
    "count_down"           : true,

    "period"               : [
       {
            "name"         : "First quarter",
            "duration"     : 720,
            "start_time"   : null,
            "elapsed_time" : 0,
            "auto_stop"    : true
        },
        {
            "name"         : "Second, quarter",
            "duration"     : 720,
            "start_time"   : null,
            "elapsed_time" : 0,
            "auto_stop"    : true
        },
        {
            "name"         : "Third quarter",
            "duration"     : 720,
            "start_time"   : null,
            "elapsed_time" : 0,
            "auto_stop"    : true
        },
        {
            "name"         : "Fourth quarter",
            "duration"     : 720,
            "start_time"   : null,
            "elapsed_time" : 0,
            "auto_stop"    : true
        },
        {
            "name"         : "Overtime",
            "duration"     : 300,
            "start_time"   : null,
            "elapsed_time" : 0,
            "auto_stop"    : true
        }
    ]
}
```

### `scheduled_start_time`
An indication of when the game should start. In most cases this is not used as the actual start time; that is left to the discretion of the game referees. It is specified in milliseconds (UTC).

### `actual_stop_time`
Once the event is over, this is set to the time that the event ended (in milliseconds, UTC).

### `running`
Indicates whether the clock is running or not.

### `last_update_time`
The time (in milliseconds UTC) that this record was last changed, e.g. the clock has started or stopped, or there is a change of period.

### `active_period`
Numerical index indicating which of the following periods is active at this moment in time or null if the game has either not yet started, or has finished.

### `count_down`
A hint to the client that the game clock counts down, rather than up. Note that the record sent to the client will always have incrementing times and it is up to the client to perform any translation to the time representation displayed to the user. If not specified, defaults to `false`.

### `period`
An array of game periods. Note that it is possible to add new periods as the game progresses (e.g. to add extra time / overtime periods).

### `period / name`
User-friendly display name for the period.

### `period / duration`
Length (in seconds) of this period.

### `period / start_time`
The time (in milliseconds UTC) at which this period became active, else null.

### `period / elapsed_time`
The elapsed clock time (in milliseconds) since this period started. If a clock is stopped (e.g. for in-game timeout) then this is reflected in this field.

### `period / auto_stop`
Some game periods (e.g. basketball) automatically stop when the clock reaches a given time, whereas others can continue until the game officials indicates otherwise. Setting this to `true` will cause the clock to stop when the `elapsed_time` reaches the period duration.

## Control flow

From the publisher's side, there are 3 major functions; start a clock, stop a clock and update the Diffusion topic. Starting & stopping clocks also include starting and stopping a timer thread.

### Start clock

1. If the event is not started, set the active period to the first one, and set the start time of the event.
2. Set the clock state to "running".
3. Start a timer thread to keep track of elapsed time.
4. Call the wrapper that updates the Diffusion topic for the clock.

### Stop clock

1. Set the clock state to "stopped"
2. Stop the timer thread.
3. Call the wrapper that updates the Diffusion topic for the clock.

### Update Diffusion topic

1. Set the elapsed time for the current period to the last value as updated by a timer thread.
2. Set the last updated time for the topic to the current time.
3. Update the Diffusion topic.

### Timer thread

1. Waits for 1 second.
2. Updates the elapsed time by 1 second.
3. Repeat.

## Client flow

The client needs to react to clock updates, and can use them to synchronise its own internal model of the clock. Like the published, it also uses a timer thread to track elapsed time between these updates, but a clock message from the server can reset the internal elapsed time that the timer thread maintains.

1. If the clock is running, start the timer thread (if not already running).
2. If the clock is stopped, stop the timer thread (if running).
3. Display the clock.

### Timer thread

1. Waits for 1 second.
2. Updates the elapsed time by 1 second.
3. Displays the clock.
4. Repeat.
