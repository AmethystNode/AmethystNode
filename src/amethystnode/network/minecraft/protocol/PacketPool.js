const LoginPacket = amethystnode("network/minecraft/protocol/LoginPacket");
const PlayStatusPacket = amethystnode("network/minecraft/protocol/PlayStatusPacket");
const DisconnectPacket = amethystnode("network/minecraft/protocol/DisconnectPacket");
const ResourcePacksInfoPacket = amethystnode("network/minecraft/protocol/ResourcePacksInfoPacket");
const ResourcePackClientResponsePacket = amethystnode("network/minecraft/protocol/ResourcePackClientResponsePacket");
const ResourcePackChunkRequestPacket = amethystnode("network/minecraft/protocol/ResourcePackChunkRequestPacket");
const RequestChunkRadiusPacket = amethystnode("network/minecraft/protocol/RequestChunkRadiusPacket");
const TextPacket = amethystnode("network/minecraft/protocol/TextPacket");

class PacketPool {
    constructor(){
        this.packetPool = new Map();
        this.registerPackets();
    }

    registerPacket(packet){
        this.packetPool.set(packet.getId(), packet);
    }

    getPacket(id){
        return this.packetPool.has(id) ? new (this.packetPool.get(id))() : null;
    }

    isRegistered(id){
        return this.packetPool.has(id);
    }

    registerPackets(){
        this.registerPacket(LoginPacket);
        this.registerPacket(PlayStatusPacket);
        //serverclienthandshake
        //viseversa
        this.registerPacket(DisconnectPacket);
        this.registerPacket(ResourcePacksInfoPacket);
        this.registerPacket(ResourcePackClientResponsePacket);
        this.registerPacket(ResourcePackChunkRequestPacket);
        this.registerPacket(RequestChunkRadiusPacket);
        this.registerPacket(TextPacket);
    }
}

module.exports = PacketPool;