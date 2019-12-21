.PHONY:start
start: keys/localhost.crt data/1.json
	node src/app.js

.PHONY:install
install: keys/localhost.crt data/1.json
	npm i

keys/localhost.crt:
	openssl req -x509 -out localhost.crt -keyout localhost.key \
	  -newkey rsa:2048 -nodes -sha256 \
	  -subj '/CN=localhost' -extensions EXT -config <( \
	  printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")

data/1.json:
	@echo 'Generating fake api data'
	cd data; php convert.php
