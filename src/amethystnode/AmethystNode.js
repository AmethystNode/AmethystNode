const Path = require("path");

require("./utils/methods/Globals");

const Logger = amethystnode("logger/Logger");
const Server = amethystnode("Server");

function AmethystNode(paths){
    this.START_TIME = Date.now();
    this.NAME = "AmethystNode";
    this.CODENAME = "[FUTURE]";
    this.VERSION = "0.0.1";
    this.API_VERSION = "1.0.0";

    let logger = new Logger("Server");
    let path = {
        file: Path.normalize(__dirname + "/../"),
        data: Path.normalize(__dirname + "/../../"),
        plugins: Path.normalize(__dirname + "/../../plugins/")
    };

    for(let i in paths) if(typeof path[i] !== "undefined") path[i] = paths[i];

    logger.info("Loading AmethystNode...");

    let server = new Server(this, logger, path);
    if(TRAVIS_BUILD === true){
        server.shutdown();
    }

    return server;
}

module.exports = AmethystNode;
