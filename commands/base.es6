import ioCore from 'iocore';
import * as shell from 'shelljs';

/**
 * BaseCommand provides all the common functionality to successfully run
 * desired shell commands
 *
 * Also provides logging methods, NPM methods, can run other commands
 */
export class BaseCommand {

    constructor()
    {
        this.args = {};
        this.container = null;
    }

    /**
     * Container is core instance
     *
     * @param container ioCore
     */
    setContainer(container) {
        this.container = container;
        return this;
    }

    /**
     * Setting up CLI arguments
     *
     * @param arguments
     */
    setArguments(...args) {
        // TODO: Arguments are options from the CLI

        return this;
    }

    npm(...args)
    {
        return this.shell('npm ' + args);
    }

    shell(...args)
    {
        return shell.exec(args.join(' ')).code;
    }

    /**
     * ioCore runCommand alias
     *
     * @param command
     * @param args
     */
    runCommand(command, ...args)
    {
        return this.container.runCommand(command, ...args);
    }

    runCommandsBunch(commands)
    {
        // TODO: run bunch of commands and continue next only if previous finished successfully
    }

    runCommands(commands)
    {
        // TODO: run commands without regarding of their result
    }
}
