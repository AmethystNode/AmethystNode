const CommandSender = amethystnode("command/CommandSender");

const MinecraftInfo = amethystnode("network/minecraft/Info");
const PlayerSessionAdapter = amethystnode("network/PlayerSessionAdapter");

const DataPacket = amethystnode("network/minecraft/protocol/DataPacket");
const LoginPacket = amethystnode("network/minecraft/protocol/LoginPacket");
const PlayStatusPacket = amethystnode("network/minecraft/protocol/PlayStatusPacket");
const DisconnectPacket = amethystnode("network/minecraft/protocol/DisconnectPacket");
const ResourcePacksInfoPacket = amethystnode("network/minecraft/protocol/ResourcePacksInfoPacket");
const StartGamePacket = amethystnode("network/minecraft/protocol/StartGamePacket");
const ChunkRadiusUpdatedPacket = amethystnode("network/minecraft/protocol/ChunkRadiusUpdatedPacket");
const TextPacket = amethystnode("network/minecraft/protocol/TextPacket");
const FullChunkDataPacket =  amethystnode("network/minecraft/protocol/FullChunkDataPacket");

const DataPacketSendEvent = amethystnode("event/server/DataPacketSendEvent");

const GameRule = amethystnode("level/GameRule");

const Vector3 = amethystnode("math/Vector3");

const Skin = amethystnode("entity/Skin");

const TextFormat = amethystnode("utils/TextFormat");
const Base64 = amethystnode("utils/Base64");

const Async = amethystnode("utils/Async");

class Player extends CommandSender {
    static get SURVIVAL(){return 0}
    static get CREATIVE(){return 1}
    static get ADVENTURE(){return 2}
    static get SPECTATOR(){return 3}
    static get VIEW(){return Player.SPECTATOR}

    initVars(){
        this._sessionAdapter = null;

        this._protocol = -1;

        this.playedBefore = false;
        this.spawned = false;
        this.loggedIn = false;
        this.joined = false;
        this.closed = false;
        this.gamemode = null;

        this._authenticated = false;
        this._xuid = "";

        this.speed = null;

        this.creationTime = 0;

        this._randomClientId = 0;

        this._ip = "";
        this._port = 0;
        this._username = "";
        this._iusername = "";
        this._displayName = "";
        this._clientId = null;

        this._viewDistance = -1;

        this._skin = {};

        this._needACK = {};
    }
    
    constructor(server, clientId, ip, port){
        super(server);
        this.initVars();
        this._clientId = clientId;
        this._ip = ip;
        this._port = port;
        this.creationTime = Date.now();

        this._sessionAdapter = new PlayerSessionAdapter(this);
    }

    getLeaveMessage(){
        if(this.joined){
            return TextFormat.YELLOW + this.getName() + " has left the game";
        }
        return "";
    }

    isConnected(){
        return this._sessionAdapter !== null;
    }
    
    static isValidUserName(name){
        return name.toLowerCase() !== "rcon" && name.toLowerCase() !== "console" && name.length >= 1 && name.length <= 16 && /[^A-Za-z0-9_ ]/.test(name);
    }

    isAuthenticated(){
        return this._authenticated;
    }

    getXuid(){
        return this._xuid;
    }

    hasPlayedBefore(){
        return this.playedBefore;
    }

    getName(){
        return this._username;
    }

    getLowerCaseName(){
        return this._iusername;
    }

    getAddress(){
        return this._ip;
    }

    getPort(){
        return this._port;
    }

    handleLogin(packet){
        CheckTypes([LoginPacket, packet]);

        if(this.loggedIn){
            return false;
        }

        this._protocol = packet.protocol;

        if(packet.protocol !== MinecraftInfo.PROTOCOL){
            if(packet.protocol < MinecraftInfo.PROTOCOL){
                this.sendPlayStatus(PlayStatusPacket.LOGIN_FAILED_CLIENT, true);
            }else{
                this.sendPlayStatus(PlayStatusPacket.LOGIN_FAILED_SERVER, true);
            }

            this.close("", "Incompatible Protocol", false);

            return true;
        }

        this._username = TextFormat.clean(packet.username);
        this._displayName = this._username;
        this._iusername = this._username.toLowerCase();

        //todo: add kick
        //if(this.server.isFull() && this.kick("Server Full", false)){
        //    return true;
        //}

        this._randomClientId = packet.clientId;

        //todo: uuids

        if(Player.isValidUserName(packet.username)){
            this.close("", "Invalid Username");
            return true;
        }

        let skin = new Skin(
            packet.clientData.SkinId,
            Base64.decode(packet.clientData.SkinData ? packet.clientData.SkinData : ""),
            Base64.decode(packet.clientData.CapeData ? packet.clientData.CapeData : ""),
            packet.clientData.SkinGeometryName,
            Base64.decode(packet.clientData.SkinGeometry ? packet.clientData.SkinGeometry : "")
        );

        if(!skin.isValid()){
            this.close("", "Invalid Skin");
            return true;
        }

        this._skin = skin;

        //todo: if whitelisted/banned kick

        Async(function(){
            const MOJANG_ROOT_PUBLIC_KEY = "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE8ELkixyLcwlZryUQcu1TvPOmI2B7vX83ndnWRUaXm74wFfa5f/lwQNTfrLVHa2PmenpGI6JhIMUJaWZrjmMj90NoKNFSNBuKdm8rYiXsfaz3K36x/1U26HpG0ZxK/V1V";
            let info = {
                authenticated: false,
                valid: false
            };

            void function(){
                function validateToken(jwt, _, first = false){
                    let [headB64, payloadB64, sigB64] = jwt.split(".");

                    let headers = JSON.parse(Base64.decode((headB64.replace(/-/g, "+").replace(/_/g, "/")), true));

                    if(_.currentPublicKey === null){
                        if(!first){
                            return false;
                        }
                        _.currentPublicKey = headers.x5u;
                    }

                    let plainSignature = Base64.decode((sigB64.replace(/-/g, "+").replace(/_/g, "/")), true);

                    assert(plainSignature.length === 96);

                    let [rString, sString] = [plainSignature.substr(0, 48), plainSignature.substr(48)];

                    rString = rString.ltrim("\x00");
                    if(rString.charCodeAt(0) >= 128){
                        rString = "\x00" + rString;
                    }

                    sString = sString.ltrim("\x00");
                    if(sString.charCodeAt(0) >= 128){
                        sString = "\x00" + sString;
                    }

                    let sequence = "\x02" + String.fromCharCode(rString.length) + rString + "\x02" + String.fromCharCode(sString.length) + sString;
                    let derSignature = "\x30" + String.fromCharCode(sequence.length) + sequence;

                    let pub = [
                        "-----BEGIN PUBLIC KEY-----",
                        _.currentPublicKey.wordwrap(64, "\n", true),
                        "-----END PUBLIC KEY-----\n"
                    ].join("\n");

                    const crypto = require("crypto");
                    let verified =
                        crypto.createVerify("SHA384")
                            .update(headB64+"."+payloadB64)
                            .verify(pub, derSignature, "latin1");

                    if(!verified){
                        return false;
                    }

                    if(_.currentPublicKey === MOJANG_ROOT_PUBLIC_KEY){
                        info.authenticated = true;
                    }

                    let claims = JSON.parse(Base64.decode((payloadB64.replace(/-/g, "+").replace(/_/g, "/")), true));

                    let now = Math.floor(Date.now() / 1000);
                    if(claims.nbf && claims.nbf > now){
                        return false;
                    }

                    if(claims.exp && claims.exp < now){
                        return false;
                    }

                    _.currentPublicKey = claims.identityPublicKey ? claims.identityPublicKey : null;

                    return true;
                }

                let _ = { //hack since js doesnt have &
                    currentPublicKey: null
                };
                let first = true;

                for(let i in packet.chainData.chain){
                    let jwt = packet.chainData.chain[i];
                    if(!validateToken(jwt, _, first)){
                        return;
                    }
                    first = false;
                }

                if(!validateToken(packet.clientDataJwt, _)){
                    return;
                }

                info.valid = true;
            }();
            
            return info;
        }.bind(this))
            .then(function(info){
                if(!this.isConnected()){
                    this.getServer().getLogger().error("Player " + this.getName() + " was disconnected before their login could be verified");
                }else{
                    this.onVerifyCompleted(packet, info.valid, info.authenticated);
                }
            }.bind(this));

        return true;
    }

    onVerifyCompleted(packet, isValid, isAuthenticated){
        if(this.closed) return;

        if(!isValid){
            this.close("", "Invalid Session");
            return;
        }

        this._authenticated = isAuthenticated;

        if(!isAuthenticated){
            if(this.server.requiresAuthentication() && this.kick("This server requires authentication.", false)){
                return;
            }

            this.server.getLogger().debug(this.getName() + " is NOT logged into to Xbox Live");
            if(packet.xuid === ""){
                this.server.getLogger().error(this.getName() + " should have an XUID, but none found");
            }
            this._xuid = packet.xuid;
        }

        this._processLogin();
    }

    _processLogin(){
        for(let [,p] of this.server._loggedInPlayers){
            if(p !== this && p._iusername === this._iusername){
                if(p.kick("Logged in from another location") === false){
                    this.close(this.getLeaveMessage(), "Logged in from another location");
                    return;
                }
            }else if(p.loggedIn/* && uuids equal*/){
                if(p.kick("Logged in from another location") === false){
                    this.close(this.getLeaveMessage(), "Logged in from another location");
                    return;
                }
            }
        }

        this.sendPlayStatus(PlayStatusPacket.LOGIN_SUCCESS);

        this.loggedIn = true;
        this.server.onPlayerLogin(this);
        this.server.getLogger().debug("Player logged in: "+this._username);

        let pk = new ResourcePacksInfoPacket();
        let manager = this.server.getResourcePackManager();
        pk.resourcePackEntries = manager.getResourcePacks();
        pk.mustAccept = manager.resourcePacksRequired();

        this.dataPacket(pk);
    }

    sendPlayStatus(status, immediate = false){
        let pk = new PlayStatusPacket();
        pk.status = status;
        pk.protocol = this._protocol;
        if(immediate){
            this.directDataPacket(pk);
        }else{
            this.dataPacket(pk);
        }
    }

    dataPacket(packet, needACK = false){
        return this.sendDataPacket(packet, needACK, false);
    }

    directDataPacket(packet, needACK = false){
        return this.sendDataPacket(packet, needACK, true);
    }

    sendDataPacket(packet, needACK = false, immediate = false){
        CheckTypes([DataPacket, packet], [Boolean, needACK], [Boolean, immediate]);
        if(!this.isConnected()) return false;

        if(!this.loggedIn && !packet.canBeSentBeforeLogin()){
            throw new Error("Attempted to send "+packet.getName()+" to "+this.getName()+" before they got logged in.");
        }

        let ev = new DataPacketSendEvent(this, packet);
        this.getServer().getPluginManager().callEvent(ev);
        if(ev.isCancelled()){
            return false;
        }

        let identifier = this.getSessionAdapter().sendPacket(packet, needACK, immediate);

        if(needACK && identifier !== null){
            this._needACK[identifier] = false;
            return identifier;
        }

        return true;
    }

    kick(reason = "", isAdmin = true){
        let message;
        if(isAdmin){
            if(true){//todo: not is banned
                message = "Kicked by admin." + (reason !== "" ? " Reason: " + reason : "");
            }else{
                message = reason;
            }
        }else{
            if(reason === ""){
                message = "Unknown Reason.";
            }else{
                message = reason;
            }
        }

        this.close(reason, message);
    }

    close(message, reason = "generic reason", notify = true){
        if(this.isConnected() && !this.closed){
            try{
                if(notify && reason.length > 0){
                    let pk = new DisconnectPacket();
                    pk.message = reason;
                    this.directDataPacket(pk);
                }

                this._sessionAdapter = null;

                //unsub from perms?
                //stopsleep

                if(this.joined){
                    try{
                        //save player data
                    }catch(e){
                        this.server.getLogger().error("Failed to save player data for "+this.getName());
                        this.server.getLogger().logError(e);
                    }

                    //tell server player left the game
                }
                this.joined = false;

                //if valid do chuck stuff

                if(this.loggedIn){
                    this.server.onPlayerLogout(this);
                    //can see etc
                }

                this.spawned = false;

                this.server.getLogger().info(TextFormat.AQUA + this.getName() + TextFormat.WHITE + " (" + this._ip + ":" + this._port + ") has disconnected due to " + reason);

                if(this.loggedIn){
                    this.loggedIn = false;
                    this.server.removeOnlinePlayer(this);
                }
            }catch(e){
                this.server.getLogger().logError(e);
            }finally{
                this.server.getRakNetAdapter().close(this, notify ? reason : "");
                this.server.removePlayer(this);
            }
        }
    }

    setViewDistance(distance){
        this._viewDistance = distance;

        let pk = new ChunkRadiusUpdatedPacket();
        pk.radius = this._viewDistance;
        this.dataPacket(pk);

        this.server.getLogger().debug("Setting view distance for " + this.getName() + " to " + distance);
    }

    getViewDistance(){
        return this._viewDistance;
    }

    completeLoginSequence(){
        //create entity
        this.server.getLogger().info([
            TextFormat.AQUA + this.getName() + TextFormat.WHITE + " (" + this._ip + ":" + this._port + ")",
            "is attempting to join"
        ].join(" "));

        let pk = new StartGamePacket();
        pk.playerGamemode = this.server.getGamemode(); //todo?
        pk.playerPosition = new Vector3(0, 20, 0);
        pk.seed = 0xdeadbeef;
        pk.generator = 2;
        pk.levelGamemode = 1;
        [pk.spawnX, pk.spawnY, pk.spawnZ] = [0, 5, 0];
        pk.isMultiplayerGame = true;
        pk.hasXboxLiveBroadcast = false;
        pk.hasLANBroadcast = true;
        pk.commandsEnabled = true;
        pk.gameRules = [];
        pk.hasBonusChestEnabled = false;
        pk.hasStartWithMapEnabled = false;
        pk.hasTrustPlayersEnabled = true;
        pk.xboxLiveBroadcastMode = 0;
        pk.levelName = this.server.getMotd();
        pk.currentTick = this.server.getCurrentTick();
        pk.enchantmentSeed = 123456;
        pk.time = 0;
        pk.hasAchievementsDisabled = true;
        //pk.gameRules = this.getServer().getDefaultLevel().getGameRules();
        pk.gameRules = [
            new GameRule(GameRule.COMMAND_BLOCK_OUTPUT, true),
            new GameRule(GameRule.DO_DAYLIGHT_CYCLE, true),
            new GameRule(GameRule.DO_ENTITY_DROPS, true),
            new GameRule(GameRule.DO_FIRE_TICK, true),
            new GameRule(GameRule.DO_MOB_LOOT, true),
            new GameRule(GameRule.DO_MOB_SPAWNING, true),
            new GameRule(GameRule.DO_TILE_DROPS, true),
            new GameRule(GameRule.DO_WEATHER_CYCLE, true),
            new GameRule(GameRule.DROWNING_DAMAGE, true),
            new GameRule(GameRule.FALL_DAMAGE, true),
            new GameRule(GameRule.FIRE_DAMAGE, true),
            new GameRule(GameRule.KEEP_INVENTORY, false),
            new GameRule(GameRule.MOB_GRIEFING, true),
            new GameRule(GameRule.NATURAL_REGENERATION, true),
            new GameRule(GameRule.PVP, true),
            new GameRule(GameRule.SEND_COMMAND_FEEDBACK, true),
            new GameRule(GameRule.SHOW_COORDINATES, true),
            new GameRule(GameRule.RANDOM_TICK_SPEED, 3),
            new GameRule(GameRule.TNT_EXPLODES, true)
        ];
        this.dataPacket(pk);

        this.server.addOnlinePlayer(this);
        this.server.onPlayerCompleteLoginSequence(this);

        //this.sendPlayStatus(PlayStatusPacket.PLAYER_SPAWN);
    }

    chat(message){
        //if(this.spawned === false || !this.isAlive()){
        //    return false;
        //}

        //this.resetCraftingGridType();

        message = TextFormat.clean(message, false);//this._removeFormat);
        
        message = message.split("\n");
        for(let i in message){
            let messagePart = message[i];
            if(messagePart.trim() !== "" && messagePart.length <= 255){// && this.messageCounter-- > 0){
                if(messagePart.startsWith("./")){
                    messagePart = messagePart.substr(1);
                }

                if(messagePart.startsWith("/")){
                    this.server.getCommandMap().dispatchCommand(this, messagePart.substr(1));
                }else{
                    let msg = "<:player> :message".replace(":player", this.getName()).replace(":message", messagePart);
                    this.server.getLogger().info(msg);
                    this.server.broadcastMessage(msg);
                }
            }
        }

        return true;
    }

    sendMessage(message){
        let pk = new TextPacket();
        pk.type = TextPacket.TYPE_RAW;
        pk.message = message;
        this.dataPacket(pk);
    }

    sendChunk(chunk){
        let pk = new FullChunkDataPacket();
        pk.chunkX = chunk.getX();
        pk.chunkZ = chunk.getZ();
        pk.data = chunk.toBinary();
        this.dataPacket(pk);
    }
    
    /**
     * @return {PlayerSessionAdapter}
     */
    getSessionAdapter(){
        return this._sessionAdapter;
    }
}

module.exports = Player;
