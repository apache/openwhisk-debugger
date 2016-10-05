import it from '../helpers/driver'

it('should create an action, then attach, invoke, detach, delete, and finally quit without error', (name) => [
    `create ${name} nodejs function main(params) { return { message: "Hello " + params.name } }`,
    `attach ${name} -a`,
    `invoke ${name}`,
    `c`,
    `c`,
    `quit`, // quit the debugger
    `detach ${name}`,
    `delete ${name}`
], ['-c']); // use the cli debugger
