{EventEmitter} = require 'events'

prog =  require './programator.js'
Can = prog.Can;
SerialPortStream = require 'serial-port-stream'

module.exports = (env) ->

    class Can2 extends EventEmitter
        write: (msg)=> env.logger.info(msg)
        
    class CanPlugin extends env.plugins.Plugin
        init: (app, @framework, @config) =>
            canPort = @config.port || "/dev/ttyUSB0";
            port = new SerialPortStream(canPort);

            can = new Can(port, 2);

            can.setMaxListeners 0
            can.on 'data', (msg)=> env.logger.debug(msg)

            deviceConfigDef = require("./can-device-config-schema")

            @framework.deviceManager.registerDeviceClass("CanSwitch", {
                configDef: deviceConfigDef.CanSwitch, 
                createCallback: (config, lastState) => new CanSwitch(config, lastState)
            })
            
            @framework.deviceManager.registerDeviceClass("CanControlButtons", {
                configDef: 
                    title: "CanControlButtons"
                    type: "object"
                    extensions: ["xLink", "xConfirm", "xOnLabel", "xOffLabel"]
                    properties: {}
                createCallback: (config, lastState) => new CanControlButtons(config, lastState)
            })
            
            @framework.deviceManager.registerDeviceClass("CanButtons", {
                configDef: deviceConfigDef.CanButtons, 
                createCallback: (config, lastState) => new CanButtons(config, lastState)
            })
            
            class CanControlButtons extends env.devices.ButtonsDevice
                constructor: (config, lastState) ->
                    config.buttons = [
                        {
                            id: 'reset'
                            text: 'Reset'
                        },
                        {
                            id: 'heartbeat'
                            text: 'Heartbeat'
                        }
                    ]
                    super(config, lastState) 
                    @on('button', (id)=>
                        if id == 'reset'
                            env.logger.debug('reset')
                            port.close();
                            port = new SerialPortStream(canPort);
                            can = new Can(port, 2);
                        else
                            env.logger.debug('heartbeat')
                            msg = op: 'heartbeat' 
                            can.write msg
                    )
            
            class CanSwitch extends env.devices.DummySwitch
                constructor: (config, lastState) ->
                    @setMaxListeners 0
                    @on('state', (state)=>
                        msg = 
                            addr: config.addr,
                            pin: config.pin,
                            state: if state == on then 0 else 1
                            op: 'setPin'
                            
                        can.write msg
                    )
                    super(config, lastState)
            
            class CanButtons extends env.devices.ButtonsDevice
                constructor: (config)-> 
                    super(config)
                    buttons = config.buttons
                    can.on 'data', (msg)=>
                        return if msg.addr != config.addr || msg.state!=1
                        pin = buttons.filter((x)->x.pin == msg.pin)
                        @buttonPressed(pin[0].id) if pin.length > 0

    return new CanPlugin
   
