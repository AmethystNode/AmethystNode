const DataPacket = amethystnode("network/minecraft/protocol/DataPacket");
const MinecraftInfo = amethystnode("network/minecraft/Info");

class ResourcePacksInfoPacket extends DataPacket {
    static getId(){
        return MinecraftInfo.RESOURCE_PACKS_INFO_PACKET;
    }

    initVars(){
        this.mustAccept = false;
        this.behaviorPackEntries = [];
        this.resourcePackEntries = [];
    }

    constructor(){
        super();
        this.initVars();
    }

    _encodePayload(){
        this.writeBool(this.mustAccept);
        this.writeLShort(this.behaviorPackEntries.length);
        this.behaviorPackEntries.forEach(entry => {
            this.writeString(entry.getPackId())
                .writeString(entry.getPackVersion())
                .writeLLong(entry.getPackSize())
                .writeString("")
                .writeString("");
        });
        this.writeLShort(this.resourcePackEntries.length);
        this.resourcePackEntries.forEach(entry => {
            this.writeString(entry.getPackId())
                .writeString(entry.getPackVersion())
                .writeLLong(entry.getPackSize())
                .writeString("")
                .writeString("");
        });
    }
}

module.exports = ResourcePacksInfoPacket;