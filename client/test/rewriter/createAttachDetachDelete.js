import it from '../helpers/driver'

it('should create an attach, then attach, detach, delete, and finally quit without error', (name) => [
    `create ${name} nodejs function main(params) { return { message: "Hello " + params.name } }`,
    `attach ${name}`,
    `detach ${name}`,
    `delete ${name}`
]);
