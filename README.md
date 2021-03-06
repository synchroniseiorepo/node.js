[Synchronise.IO](https://www.synchronise.io)
--------------

The Javascript client allows you to communicate with Synchronise from your Node.JS server.
The library communicates with Synchronise using Web Sockets for faster transfer and better development experience as well as better user experience. We have implemented socket connection using the open source library [Socket.IO](http://socket.io/) because it provides cross-platform compatibility.

----------


### Setup

    npm install synchronise


----------


### Init
To load the package for Synchronise in your Node.Js script simply use:

    var Synchronise = require('synchronise');
		Synchronise.init("[YOUR PUBLIC KEY]");

Alternatively you can also initialise the library directly when you require it:

    var Synchronise = require('synchronise')("[YOUR PUBLIC KEY]");

You can find your Public Key on the export section of a Component.

![Find your public key](https://images.synchronise.io/public_key.png)

----------


### Component
#### Run
The run method allows you to execute a component on our Cloud.

**Parameters:**

 - (String)id_component: The first parameter is the ID of the component.
   It is provided to you on the interface on www.synchronise.io
 - (JSON)parameters: A JSON Key-value for all of the parameters you want
   to send to the component. If there is no parameter to send simply   
   provide an empty JSON {}
 - (Object)callbacks: The list of callbacks    triggered by the
   execution of the Component
	   - **success**: Is called if the execution of the Component has succeeded. The first parameter of the callback contains the data provided by the component (if any)
	   - **error**: The error callback is triggered if the component has timed out or if its execution has failed. The first parameter of the callback contains the err object describing the reason for failing
	   - **always**: The always callback allows you to know when the execution of the component is done. It is triggered whether the component succeeds or not. This is useful for example to know when to hide a loading image if you had put one on your interface while the component was executing. The always callback is not triggered by the progress callback

**Example:**
```
Synchronise.Component.run("ID-OF-THE-COMPONENT", {/* param1:"val1"... */}, {
    success: function(data){
    },
    error: function(error){
    },
    always: function(){
	    // Called every time success or error is called
    }
});
```

----------


### Workflow
#### Run
The run method allows you to execute a workflow on our Cloud.

**Parameters:**

 - (String)id_workflow: The first parameter is the ID of the workflow.
   It is provided to you on the interface on www.synchronise.io
 - (JSON)parameters: A JSON Key-value for all of the parameters you want
   to send to the workflow. If there is no parameter to send simply   
   provide an empty JSON {}
 - (Object)callbacks: The list of callbacks    triggered by the
   execution of the Workflow
	   - **success**: Is called if the execution of the Workflow has succeeded. The first parameter of the callback contains the data provided by the workflow (if any)
	   - **error**: The error callback is triggered if the workflow has timed out or if its execution has failed. The first parameter of the callback contains the err object describing the reason for failing
	   - **always**: The always callback allows you to know when the execution of the workflow is done. It is triggered whether the workflow succeeds or not. This is useful for example to know when to hide a loading image if you had put one on your interface while the workflow was executing. The always callback is not triggered by the progress callback

**Example:**
```
Synchronise.Workflow.run("ID-OF-THE-WORKFLOW", {/* param1:"val1"... */}, {
    success: function(data){
    },
    error: function(error){
    },
    always: function(){
	    // Called every time success or error is called
    }
});
```
