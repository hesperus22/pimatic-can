var byline = require('byline');
var fs = require('fs');
var stream  = require('stream');
var Transform = stream.Transform;
var Duplex = stream.Duplex;
var util = require('util');
var Parser = require('stream-parser');

function Upgrader(addr){
    if(!(this instanceof Upgrader))
        return new Upgrader(addr);

    Transform.call(this, {objectMode: true});

    this.erased = [];

    this.addr = addr;
}

util.inherits(Upgrader, Transform);

Upgrader.prototype._transform = function(op, enc, done){
    var self = this;
    if(op.end){
        if(self.deffered){
            return done(null, self.deffered);
        } else
            return done();
    }
    
    var startPage = Math.round(op.offset/1024);
    var endPage = Math.round((op.offset + op.data.length)/1024);

    var erase = function(page){
        if(self.erased.indexOf(page)==-1){
            self.erased.push(page);
            self.push({
                addr: self.addr,
                op: 'erasePage',
                page: page
            });
        }
    }

    erase(startPage);
    erase(endPage);

    var push = function(slice){
        var data = {
            addr: self.addr,
            op: 'flash',
            dataAddr: op.addr + slice,
            offset: op.offset + slice,
            data: op.data.slice(slice, slice + 8)
        }
        if(data.offset == 0x5000)
            self.deffered = data;
        else 
            self.push(data);
    }

    for(var i = 0; i<op.data.length; i += 8){
        push(i);
    }

    done();
}

function HexParser(){
    if(!(this instanceof HexParser))
        return new HexParser();

    Transform.call(this, {objectMode: true});
    this.base = 0;
}

util.inherits(HexParser, Transform);

var types = [];

HexParser.prototype._transform = function(chunk, encoding, done){
    var line = chunk.toString('ascii');

    if(line[0]!==':')
        done(new Error('Line should start with ":".'));

    line = line.substring(1);

    var hex = [];
    var checksum = 0;

    for(var i = 0; i<line.length; i+=2){
        var d = parseInt(line.substring(i,i+2), 16);
        hex.push(d);
        checksum += 0;
    }

    if(checksum & 0xFF !== 0)
        done(new Error('Checkum failed'));

    var length = hex[0];
    var addr = hex[1]*0x100+hex[2];
    var type = hex[3];
    var data = hex.slice(4, 4+length);

    switch(type){
        case 4:
            this.base = (data[0]*0x100 + data[1])<<16;
        case 5:
            done();
            break;
        case 1:
            done(null, { end: true });
            break;
        case 0:
            done(null, {
                data: data,
                base: this.base,
                offset: addr,
                addr: addr + this.base
            });
            break;
    }
}

function Can(duplex, slots){
    if(!(this instanceof Can))
        return new Can(duplex, slots);

    var self = this;

    Duplex.call(self, {objectMode: true});

    self._duplex = duplex;
    self._maxSlots = slots;
    self._slots = slots;
    self._queue = [];
    self._rx = new CanRx();
    self._tx = new CanTx();
    if(duplex) {
        self._tx.pipe(duplex).pipe(self._rx);
    }

    self._rx.on('end', function(){
        self.push(null);
    });
    
    self.once('finish', function(){self._tx.end();});

    self._rx.on('data', function(msg){
        if(msg.msg=='ack') {
            if(self._slots == 0 && self._queue.length > 0){
                var pending = self._queue.shift();
                self._tx.write(pending.chunk, null, pending.cb);
            } else {
                self._slots = Math.min( self._slots + 1, self._maxSlots);
            }
        }
        else {
            self.push(msg);
        }
    });

    self._rx.resume();
}

util.inherits(Can, Duplex);

Can.prototype._read = function(){
    var self = this;
};

Can.prototype._write = function(chunk, enc, cb){
    if(this._slots > 0){
        this._slots--;
        this._tx.write(chunk, null, cb);
    } else {
        this._queue.push({chunk: chunk, cb: cb});
    }
}

function CanRx(){
    if(!(this instanceof CanRx))
        return new CanRx();

    Transform.call(this, {objectMode: true});

    this._bytes(5, this.onLength);
}

util.inherits(CanRx, Transform);

Parser(CanRx.prototype);

CanRx.prototype.onLength = function(buffer, done){
    var eid = buffer.readUInt32LE(0);
    var length = buffer.readInt8(4);
    if(eid==0){
        done({msg: 'ack'});
        this._bytes(5, this.onLength);
    }else{
        var cb = function(buffer, done){
            var msg = {addr: eid >> 19};
            var cmd = (eid >> 14) & 0x1F;
            var data = eid & 0x3FFF;
            switch(cmd){
                case 4:
                    msg.msg = 'pinChanged';
                    msg.pin = data>>1;
                    msg.state = data & 1;
                    done(msg);
                    break;
                }
            this._bytes(5, this.onLength);
        };

        if(length > 0)
            this._bytes(length, cb);
        else
            cb.call(this, new Buffer([]), done);
    }
};

function CanTx(){
    if(!(this instanceof CanTx))
        return new CanTx();

    Transform.call(this, {objectMode: true});
}

util.inherits(CanTx, Transform);

CanTx.prototype._transform = function(msg, enc, done){
    var addr = msg.addr << 19;
    switch(msg.op){
        case 'heartbeat':
            var buf = new Buffer(5);
            var cmd = 6<<14;
            buf.writeUInt32LE(cmd, 0);
            buf.writeUInt8(0, 4);
            return done(null, buf);
        case 'setPin':
            var buf = new Buffer(5);
            var cmd = addr + (2<<14)+(msg.pin<<1)+msg.state;
            buf.writeUInt32LE(cmd, 0);
            buf.writeUInt8(0, 4);
            return done(null, buf);
        case 'readPin':
            console.log('readPin');
            var buf = new Buffer(5);
            var cmd = addr + (3<<14)+msg.pin;
            buf.writeUInt32LE(cmd, 0);
            buf.writeUInt8(0, 4);
            return done(null, buf);
        case 'reset':
            console.log('reset');
            var buf = new Buffer(5);
            var cmd = addr + (5<<14);
            buf.writeUInt32LE(cmd, 0);
            buf.writeUInt8(0, 4);
            return done(null, buf);
        case 'erasePage':
            console.log('page', msg.page);
            var buf = new Buffer(5);
            var cmd = addr + msg.page;
            buf.writeUInt32LE(cmd, 0);
            buf.writeUInt8(0, 4);
            return done(null, buf);
        case 'flash':
            console.log('flash', Math.round(msg.offset/8));
            var buf = new Buffer(5 + msg.data.length);
            var cmd = addr + (1<<14) + Math.round(msg.offset/8);
            buf.writeUInt32LE(cmd, 0);
            buf.writeUInt8(msg.data.length, 4);
            for(var i = 0; i < msg.data.length; i++)
                buf.writeUInt8(msg.data[i], 5 + i);
            return done(null, buf);
    }

    done();
}



exports.upgrade = function(addr, file, can){
    var hex = HexParser();
    var upgrader = Upgrader(addr);

    var lines = byline(fs.createReadStream(file, {encoding: 'ascii'}));
    lines.pipe(hex).pipe(upgrader).pipe(can);

};

exports.CanRx = CanRx;
exports.CanTx = CanTx;
exports.Can = Can;
