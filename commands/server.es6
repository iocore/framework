import { BaseCommand } from 'iocore/commands/base';

export class ServerCommand extends BaseCommand {
    run()
    {
        console.log('Running server');
        this.container.bootstrap().listen();
        //return this.shell('ls');
    }
}
