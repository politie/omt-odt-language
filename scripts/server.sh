#!/usr/bin/env bash

export CODE_TESTS_PATH="$(pwd)/server/out/test"
export CODE_TESTS_WORKSPACE="$(pwd)/server/testFixture"

mocha "./server/src/**/*.test.ts"
