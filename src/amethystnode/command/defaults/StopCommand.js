const Command = amethystnode("command/Command");

class StopCommand extends Command {
    constructor(){
        super("stop", "Stops the server.", "amethystnode.command.stop", ["shutdown"]);
    }

    execute(sender, args){
        sender.getServer().shutdown();
    }
}

module.exports = StopCommand;