#!/bin/sh
":" //# comment; exec /usr/bin/env node --max_old_space_size=3000 "$0" "$@"
require("../dist/src/index.js");