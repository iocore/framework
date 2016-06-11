import ioCore from 'iocore';
import * as shell from 'shelljs';

/**
 * BaseCommand provides all the common functionality to successfully run
 * desired shell commands
 *
 * Also provides logging methods, NPM methods, can run other commands
 *
 * @link https://www.npmjs.com/package/shelljs
 * @link http://momentjs.com/docs/
 */
export class BaseCommand {

    constructor()
    {
        this.container = null;
        this.shell = shell;
    }

    /**
     * Container is core instance
     *
     * @param container ioCore
     */
    setContainer(container)
    {
        this.container = container;
        return this;
    }

    /**
     * Runs available shell command (supportable by shelljs)
     * and passing arguments to it.
     * Arguments will be joined
     *
     * @param command
     * @param args
     * @returns {*} result code
     */
    shell(command, ...args)
    {
        if (this.shell.hasOwnProperty(command)) {
            return this.shell[command](args.join(' ')).code;
        }
        this.error(`Shelljs does not support command "${command}"`);
        return 1;
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

    /**
     * Running bunch of commands and check if all of them has been finished successfully
     *
     * @param commands
     * @returns {BaseCommand}
     */
    runCommandsBunch(commands)
    {
        Reflect.ownKeys(commands).forEach((command) => {
            let args = commands[command];
            let result = this.runCommand(command, ...args);

            // If result is true (or positive integer)
            // Then it's error
            if (result) {
                result = JSON.stringify(result);
                this.error(`Command failed: ${command}. Result: ${result}`);
                return 1;
            }
        });
    }

    /**
     * Running few commands without regarding of their result
     *
     * @param commands
     * @returns {BaseCommand}
     */
    runCommands(commands)
    {
        Reflect.ownKeys(commands).forEach((command) => {
            let args = commands[command];
            this.runCommand(command, ...args);
        });
        return this;
    }

    /**
     * Writing log to stdout
     *
     * @param message
     * @returns {BaseCommand}
     */
    log(message)
    {
        this.container.log(message);
        return this;
    }

    /**
     * Writing log to stderr
     *
     * @param message
     * @returns {BaseCommand}
     */
    error(message)
    {
        this.container.error(message);
        return this;
    }
}
