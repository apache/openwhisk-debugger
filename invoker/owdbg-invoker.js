function main(params) {
    request({
	url: params.broker + "/invoke",
	json: true,
	body: params
    });
}
