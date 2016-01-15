module.exports = {
    CanSwitch:
        title: "CanSwitch config"
        type: "object"
        extensions: ["xLink", "xConfirm", "xOnLabel", "xOffLabel"]
        properties:
            addr:
                description: "CAN Address"
                type: "number"
            pin:
                description: "CAN Pin"
                type: "number"
    CanButtons:
        title: "ButtonsDevice config"
        type: "object"
        extensions: ["xLink"]
        properties:
          addr:
            description: "CAN Address"
            type: "number"
          buttons:
            description: "Buttons to display"
            type: "array"
            default: []
            format: "table"
            items:
              type: "object"
              properties:
                id:
                  type: "string"
                text:
                  type: "string"
                confirm:
                  description: "Ask the user to confirm the button press"
                  type: "boolean"
                  default: false
                pin: 
                  description: "CAN pin"
                  type: "number"
                
 
}