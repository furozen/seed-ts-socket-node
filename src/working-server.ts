import {createServer, Server} from 'http';
import * as express from 'express';
import * as socketIo from 'socket.io';
import {Socket} from 'socket.io';

import config from './config';

import {createLogger, ILogger} from './logger';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import cors = require('cors');


interface IMessages {
  id:string,
  sessionId?:string
}


class Handler {

  private logger:ILogger;
  private sessionId:string;

  constructor(
    private socket:Socket
  ) {
    this.logger = createLogger(this.getLoggerContext.bind(this));
  }


  getLoggerContext = () => {
    let context = '<' + this.sessionId + '>';
    return context;
  };


  async onMessageLogic(m:IMessages) {

    this.logger.log('onMessageLogic', m);

    switch (m.id) {
      case 'Handshake': {
        this.sessionId = m.sessionId;
        this.sendMessage(m);
      }
        break;
    }
  };


  async onDisconnectLogic() {
    //TODO disconect logic
    this.logger.warn('onDisconnectLogic:Implement me');
  }

  private sendMessage(message:any) {
    this.logger.debug('send', message);
    (this.socket as any).emit(this.getMessageId(), message);
  }

  private getRoomId() {
    return this.sessionId;
  }

  private getMessageId() {
    return 'message:' + this.getRoomId();
  }


}

export class WorkingServer {
  public static readonly PORT:number = 6760;
  private app:express.Application;
  private server:Server;
  private io:SocketIO.Server;
  private port:string | number;
  private logger:ILogger;

  constructor() {
    //use  Cross-Origin Resource Sharing (CORS)
    // https://developer.mozilla.org/ru/docs/Web/HTTP/CORS
    //TODO make CORS more sophisticated https://brianflove.com/2017/03/22/express-cors-typescript/
    this.initExpressServer(!!process.env.useCORS);

    this.initSocketIO(process.env.PORT || WorkingServer.PORT);
    this.listen();
    this.logger = createLogger('WorkingServer');
  }

  public getApp():express.Application {
    return this.app;
  }

  private initExpressServer(useCors:boolean):void {
    this.app = express();
    this.app.use(cors());
    this.app.options('*', cors());


    if (config.ssl) {
      console.log(__dirname);

      const keyPath = path.join(__dirname, './keys/key.pem');
      console.log(keyPath);
      var options = {
        key:fs.readFileSync(keyPath),
        cert:fs.readFileSync(path.join(__dirname, '/keys/cert.crt'))
      };

      this.server = https.createServer(options, this.app);
    } else {
      this.server = createServer(this.app);
    }
  }

  private initSocketIO(port:string | number):void {
    this.port = port;
    this.io = socketIo(this.server);
  }

  private listen():void {
    this.server.listen(this.port, () => {
      this.logger.log('Running server on port %s', this.port);
    });

    this.io.on('connect', (socket:Socket) => {
      this.logger.log('Connected client on port %s.', this.port);

      const handler = new Handler(socket);

      socket.on('message', (m:any) => {
        handler.onMessageLogic(m);
      });


      socket.on('disconnect', () => {
        handler.onDisconnectLogic();
        this.logger.log('Client disconnected');
      });
    });
  }
}
