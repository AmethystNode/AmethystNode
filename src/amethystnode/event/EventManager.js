const Listener = amethystnode("event/Listener");
const Plugin = amethystnode("plugin/Plugin");
const RegisteredListener = amethystnode("plugin/RegisteredListener");

class EventManager {
    initVars(){
        this._listeners = [];
    }

    constructor(){
        this.initVars();
    }

    registerListener(listener, plugin){
        if(listener instanceof Listener && plugin instanceof Plugin){
            this._listeners.push(new RegisteredListener(listener, plugin));
            return true;
        }else{
            throw new Error("Must provide instances of a listener and plugin.");
        }
    }

    callEvent(name, event){
        this._listeners.forEach(listener => listener.callEvent(name, event));
    }
}

module.exports = EventManager;