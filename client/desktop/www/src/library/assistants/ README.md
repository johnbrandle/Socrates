# Assistant Overviews

<br/>

## ConcurrencyAssistant Class

The `ConcurrencyAssistant` class efficiently manages asynchronous operations with controlled concurrency, allowing prioritization of tasks and enabling abort functionality based on custom logic. It handles concurrent execution limits and operation order (LIFO or FIFO).

### Usage

Instantiate `ConcurrencyAssistant` with a specified concurrency limit, an abort controller, and an optional LIFO/FIFO preference. Use the `add` or `addImmediate` methods to queue operations. The `drain` and `aborted` methods manage the completion and abortion of operations.

### Example

```javascript
const concurrencyAssistant = new ConcurrencyAssistant(5, myAbortController);
concurrencyAssistant.add(() => {
  // Asynchronous operation
});
```

</br>

## SerialAssistant Class

The `SerialAssistant` class is designed to manage a queue of asynchronous tasks, ensuring their execution in a serial (one after the other) order. It integrates an abort controller for task cancellation and operates within a specified observable scope.

### Usage

Instantiate `SerialAssistant` with an observable scope and an abort controller. Use the `add` method to queue tasks, which can be either asynchronous or synchronous. Tasks are processed in the order they are added, with the option to abort them if necessary.

### Example

```javascript
const serialAssistant = new SerialAssistant(myObservableScope, myAbortController);
serialAssistant.add(async () => {
  // Asynchronous task
}, defaultValue);
```

<br/>

## DebounceAssistant Class

The `DebounceAssistant<T extends any[] = [], R = any>` class is designed for managing asynchronous operations through debouncing. It ensures that operations triggered in quick succession are executed reflecting the most recent state, preventing redundant or unnecessary executions. The class offers options for throttling and delay, enhancing its suitability for scenarios like user input handling or state change reactions. It also features lifecycle management for application shutdown or component disposal.

### Usage

Create an instance of `DebounceAssistant` by providing a callback for the asynchronous operation and optional configuration for throttle, delay, and debug logging. The `execute` method is used to run the callback, handling debouncing, throttling, and delay mechanisms. The class ensures that only the most recent call is executed if multiple calls are made in rapid succession.

### Example

```javascript
const appInstance = new BaseApp(); // Assuming BaseApp implements IBaseApp
const asyncAction = async (abortController, ...args) => {
  // Asynchronous operation
};
const debounceAssistant = new DebounceAssistant(appInstance, asyncAction, {
  throttle: true,
  delay: 100,
  debug: true
});

// Executing the action
debounceAssistant.execute(new AbortController(), arg1, arg2);
```

<br/>

## ButtonGroupAssistant Class

The `ButtonGroupAssißstant` class is designed to manage a group of HTML button elements. It provides functionality for handling button clicks and toggling button states, simplifying the management of button groups.

### Usage

To use `ButtonGroupAssistant`, instantiate the class with an array of button elements and a callback function. The class handles event listeners and manages the button states automatically.

Example:

```javascript
const buttons = document.querySelectorAll("button");
const buttonGroup = new ButtonGroupAssistant(buttons, (button, index) => {
  // Handle button click
});
```

<br/>

## EventListenerAssistant Class

The `EventListenerAssistant` class, part of an entity system, is a utility for managing event listeners on DOM elements. It simplifies the process of adding and removing event listeners, supporting only one handler per event type per element.

### Usage

Create an instance of `EventListenerAssistant` with a specified application context and a destructor. Use `subscribe` to add event listeners to elements, and `unsubscribe` to remove them. The class allows for either removing a specific event listener from an element or removing all event listeners from it. Additionally, the `clear` method removes all event listeners from all elements managed by the instance.

### Example

```javascript
const eventListenerAssistant = new EventListenerAssistant(appInstance, destructor, context);

// Adding an event listener
eventListenerAssistant.subscribe(element, 'click', (event) => {
  // Event handler logic
});

// Removing a specific event listener
eventListenerAssistant.unsubscribe(element, 'click');

// Removing all event listeners from an element
eventListenerAssistant.unsubscribe(element);

// Clearing all event listeners managed by this assistant
eventListenerAssistant.clear();
```

<br/>

## SignalAssistant Class

The `SignalAssistant` class is a utility for managing signals, facilitating the addition and removal of signal handlers. It's part of an entity system and simplifies the process of connecting and disconnecting handlers to signals, which are a form of custom event mechanism.

### Usage

Instantiate `SignalAssistant` with the application context and a destructor. Use `subscribe` to connect a handler to a signal, supporting both standard and weak signals. The `unsubscribe` method disconnects all handlers from a given signal. The `clear` method removes all handlers from all signals managed by this assistant.

### Example

```javascript
const signalAssistant = new SignalAssistant(appInstance, destructor, context);

// Subscribing to a signal
signalAssistant.subscribe(mySignal, (arg1, arg2) => {
  // Handler logic
}, false);

// Unsubscribing all handlers from a signal
signalAssistant.unsubscribe(mySignal);

// Clearing all handlers from all signals
signalAssistant.clear();
```

<br/>

## IntervalAssistant Class

The `IntervalAssistant` class is designed to manage timed intervals and animation frames. It provides an organized way to handle repeated or one-time executions of functions based on time intervals or requestAnimationFrame.

### Usage

Instantiate `IntervalAssistant` with an application context and a destructor. Use the `start` method to initiate a new interval or animation frame, specifying the handler function, duration, and whether it should run only once. The method returns an identifier for the interval. The `end` method stops a specific interval using its identifier. The `clear` method stops all intervals managed by this assistant.

### Example

```javascript
const intervalAssistant = new IntervalAssistant(appInstance, destructor, context);

// Starting an interval
const intervalId = intervalAssistant.start(() => {
  // Interval handler logic
}, 1000, false);

// Ending a specific interval
intervalAssistant.end(intervalId);

// Clearing all intervals
intervalAssistant.clear();
```

<br/>

## TweenAssistant Class

The `TweenAssistant` class is a utility for creating and managing tween animations. It allows for animating properties of objects smoothly over time using various easing functions.

### Usage

Instantiate `TweenAssistant` with an application context, a destructor, default animation options, and an auto-abort flag. The class offers methods like `to`, `from`, and `fromTo` for defining animations. These methods support custom start and end values, easing functions, and callbacks for start, update, and completion events. The `abortAll` method is provided to cancel all ongoing animations.

### Example

```javascript
const tweenAssistant = new TweenAssistant(appInstance, destructor);

// Creating a tween animation
tweenAssistant.to({ x: 100, y: 200 }, {
  duration: 1000,
  ease: easeOutQuad,
  onStart: () => console.log("Animation started"),
  onUpdate: (progress) => console.log(`Progress: ${progress}`),
  onComplete: () => console.log("Animation completed")
});
```

<br/>

## MotionBlurAssistant Class

The `MotionBlurAssistant` class is a specialized utility within the Entity system for creating a motion blur effect on HTML elements. It dynamically clones the target element and applies a series of transformations to simulate motion blur.

### Usage

Create an instance of `MotionBlurAssistant` with an application context, a destructor, a target HTML element, and a motion blur intensity. The `start` method initiates the motion blur effect by creating clones of the target element. The `transform` method applies transformations (scale, rotation, and translation) to both the original and cloned elements, creating the illusion of motion blur. The `end` method gracefully concludes the effect, animating the clones back to the original element's position and then removing them.

### Example

```javascript
const motionBlurAssistant = new MotionBlurAssistant(appInstance, destructor, targetElement, 3);

// Starting the motion blur effect
motionBlurAssistant.start();

// Applying a transformation with motion blur
motionBlurAssistant.transform(1.2, 45, 100, 150);

// Ending the motion blur effect
await motionBlurAssistant.end(300);
```