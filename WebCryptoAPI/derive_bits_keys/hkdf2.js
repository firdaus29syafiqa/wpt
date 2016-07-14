
function run_test() {
    // May want to test prefixed implementations.
    var subtle = self.crypto.subtle;

    // hkdf2_vectors sets up test data with the correct derivations for each
    // test case.
    var testData = getTestData();
    var passwords = testData.passwords;
    var salts = testData.salts;
    var derivations = testData.derivations;
    var infos = testData.infos;

    // What kinds of keys can be created with deriveKey? The following:
    var derivedKeyTypes = testData.derivedKeyTypes;

    setUpBaseKeys(passwords)
    .then(function(allKeys) {
        // We get several kinds of base keys. Normal ones that can be used for
        // derivation operations, ones that lack the deriveBits usage, ones
        // that lack the deriveKeys usage, and one key that is for the wrong
        // algorithm (not HKDF in this case).
        var baseKeys = allKeys.baseKeys;
        var noBits = allKeys.noBits;
        var noKey = allKeys.noKey;
        var wrongKey = allKeys.wrongKey;

        // Test each combination of password size, salt size, hash function,
        // and number of iterations. The derivations object is structured in
        // that way, so navigate it to run tests and compare with correct results.
        Object.keys(derivations).forEach(function(passwordSize) {
            Object.keys(derivations[passwordSize]).forEach(function(saltSize) {
                Object.keys(derivations[passwordSize][saltSize]).forEach(function(hashName) {
                    Object.keys(derivations[passwordSize][saltSize][hashName]).forEach(function(infoSize) {
                        var testName = passwordSize + " password, " + saltSize + " salt, " + hashName + ", with " + infoSize + " info";
                        var algorithm = {name: "HKDF", salt: salts[saltSize], hash: hashName};
                        if (infoSize !== "missing") {
                            algorithm.info = infos[infoSize];
                        }
                        // Check for correct deriveBits result
                        promise_test(function(test) {
                            return subtle.deriveBits(algorithm, baseKeys[passwordSize], 256)
                            .then(function(derivation) {
                                assert_true(equalBuffers(derivation, derivations[passwordSize][saltSize][hashName][infoSize]), "Derived correct key");
                            }, function(err) {
                                assert_unreached("deriveBits failed with error " + err.name + ": " + err.message);
                            });
                        }, testName);

                        // Check for correct deriveKey results for every kind of
                        // key that can be created by the deriveKeys operation.
                        derivedKeyTypes.forEach(function(derivedKeyType) {
                            var testName = "Derived key of type ";
                            Object.keys(derivedKeyType.algorithm).forEach(function(prop) {
                                testName += prop + ": " + derivedKeyType.algorithm[prop] + " ";
                            });
                            testName += " using " + passwordSize + " password, " + saltSize + " salt, " + hashName + ", with " + infoSize + " info";

                            // Test the particular key derivation.
                            promise_test(function(test) {
                                return subtle.deriveKey(algorithm, baseKeys[passwordSize], derivedKeyType.algorithm, true, derivedKeyType.usages)
                                .then(function(key) {
                                    // Need to export the key to see that the correct bits were set.
                                    return subtle.exportKey("raw", key)
                                    .then(function(buffer) {
                                        assert_true(equalBuffers(buffer, derivations[passwordSize][saltSize][hashName][infoSize].slice(0, derivedKeyType.algorithm.length/8)), "Exported key matches correct value");
                                    }, function(err) {
                                        assert_unreached("Exporting derived key failed with error " + err.name + ": " + err.message);
                                    });
                                }, function(err) {
                                    assert_unreached("deriveKey failed with error " + err.name + ": " + err.message);

                                });
                            }, testName);

                            // Test various error conditions for deriveKey:

                            // - illegal name for hash algorithm (NotSupportedError)
                            var badHash = hashName.substring(0, 3) + hashName.substring(4);
                            promise_test(function(test) {
                                var badAlgorithm = {name: "HKDF", salt: salts[saltSize], hash: badHash};
                                return subtle.deriveKey(badAlgorithm, baseKeys[passwordSize], derivedKeyType.algorithm, true, derivedKeyType.usages)
                                .then(function(key) {
                                    assert_unreached("bad hash name should have thrown an NotSupportedError");
                                }, function(err) {
                                    assert_equals(err.name, "NotSupportedError", "deriveKey with bad hash name correctly threw NotSupportedError: " + err.message);
                                });
                            }, testName + " with bad hash name " + badHash);

                            // - baseKey usages missing "deriveKey" (InvalidAccessError)
                            promise_test(function(test) {
                                return subtle.deriveKey(algorithm, noKey[passwordSize], derivedKeyType.algorithm, true, derivedKeyType.usages)
                                .then(function(key) {
                                    assert_unreached("missing deriveKey usage should have thrown an InvalidAccessError");
                                }, function(err) {
                                    assert_equals(err.name, "InvalidAccessError", "deriveKey with missing deriveKey usage correctly threw InvalidAccessError: " + err.message);
                                });
                            }, testName + " with missing deriveKey usage");

                            // - baseKey algorithm does not match HKDF (InvalidAccessError)
                            promise_test(function(test) {
                                return subtle.deriveKey(algorithm, wrongKey, derivedKeyType.algorithm, true, derivedKeyType.usages)
                                .then(function(key) {
                                    assert_unreached("wrong (ECDH) key should have thrown an InvalidAccessError");
                                }, function(err) {
                                    assert_equals(err.name, "InvalidAccessError", "deriveKey with wrong (ECDH) key correctly threw InvalidAccessError: " + err.message);
                                });
                            }, testName + " with wrong (ECDH) key");

                        });

                        // Test various error conditions for deriveBits below:
                        // length null (OperationError)
                        promise_test(function(test) {
                            return subtle.deriveBits(algorithm, baseKeys[passwordSize], null)
                            .then(function(derivation) {
                                assert_unreached("null length should have thrown an OperationError");
                            }, function(err) {
                                assert_equals(err.name, "OperationError", "deriveBits with null length correctly threw OperationError: " + err.message);
                            });
                        }, testName + " with null length");

                        // 0 length (OperationError)
                        promise_test(function(test) {
                            return subtle.deriveBits(algorithm, baseKeys[passwordSize], 0)
                            .then(function(derivation) {
                                assert_unreached("0 length should have thrown an OperationError");
                            }, function(err) {
                                assert_equals(err.name, "OperationError", "deriveBits with 0 length correctly threw OperationError: " + err.message);
                            });
                        }, testName + " with 0 length");

                        // length not multiple of 8 (OperationError)
                        promise_test(function(test) {
                            return subtle.deriveBits(algorithm, baseKeys[passwordSize], 44)
                            .then(function(derivation) {
                                assert_unreached("non-multiple of 8 length should have thrown an OperationError");
                            }, function(err) {
                                assert_equals(err.name, "OperationError", "deriveBits with non-multiple of 8 length correctly threw OperationError: " + err.message);
                            });
                        }, testName + " with non-multiple of 8 length");

                        // - illegal name for hash algorithm (NotSupportedError)
                        var badHash = hashName.substring(0, 3) + hashName.substring(4);
                        promise_test(function(test) {
                            var badAlgorithm = {name: "HKDF", salt: salts[saltSize], hash: badHash};
                            return subtle.deriveBits(badAlgorithm, baseKeys[passwordSize], 256)
                            .then(function(derivation) {
                                assert_unreached("bad hash name should have thrown an NotSupportedError");
                            }, function(err) {
                                assert_equals(err.name, "NotSupportedError", "deriveBits with bad hash name correctly threw NotSupportedError: " + err.message);
                            });
                        }, testName + " with bad hash name " + badHash);

                        // - baseKey usages missing "deriveBits" (InvalidAccessError)
                        promise_test(function(test) {
                            return subtle.deriveBits(algorithm, noBits[passwordSize], 256)
                            .then(function(derivation) {
                                assert_unreached("missing deriveBits usage should have thrown an InvalidAccessError");
                            }, function(err) {
                                assert_equals(err.name, "InvalidAccessError", "deriveBits with missing deriveBits usage correctly threw InvalidAccessError: " + err.message);
                            });
                        }, testName + " with missing deriveBits usage");

                        // - baseKey algorithm does not match HKDF (InvalidAccessError)
                        promise_test(function(test) {
                            return subtle.deriveBits(algorithm, wrongKey, 256)
                            .then(function(derivation) {
                                assert_unreached("wrong (ECDH) key should have thrown an InvalidAccessError");
                            }, function(err) {
                                assert_equals(err.name, "InvalidAccessError", "deriveBits with wrong (ECDH) key correctly threw InvalidAccessError: " + err.message);
                            });
                        }, testName + " with wrong (ECDH) key");
                    });
                });

                // - legal algorithm name but not digest one (e.g., PBKDF2) (NotSupportedError)
                var nonDigestHash = "PBKDF2";
                Object.keys(infos).forEach(function(infoSize) {
                    var testName = passwordSize + " password, " + saltSize + " salt, " + nonDigestHash + ", with " + infoSize + " info";
                    var algorithm = {name: "HKDF", salt: salts[saltSize], hash: nonDigestHash};
                    if (infoSize !== "missing") {
                        algorithm.info = infos[infoSize];
                    }

                    promise_test(function(test) {
                        return subtle.deriveBits(algorithm, baseKeys[passwordSize], 256)
                        .then(function(derivation) {
                            assert_unreached("non-digest algorithm should have thrown an NotSupportedError");
                        }, function(err) {
                            assert_equals(err.name, "NotSupportedError", "deriveBits with non-digest algorithm correctly threw NotSupportedError: " + err.message);
                        });
                    }, testName + " with non-digest algorithm " + nonDigestHash);

                    derivedKeyTypes.forEach(function(derivedKeyType) {
                        var testName = "Derived key of type ";
                        Object.keys(derivedKeyType.algorithm).forEach(function(prop) {
                            testName += prop + ": " + derivedKeyType.algorithm[prop] + " ";
                        });
                        testName += " using " + passwordSize + " password, " + saltSize + " salt, " + nonDigestHash + ", with " + infoSize + " info";

                        promise_test(function(test) {
                            return subtle.deriveKey(algorithm, baseKeys[passwordSize], derivedKeyType.algorithm, true, derivedKeyType.usages)
                            .then(function(derivation) {
                                assert_unreached("non-digest algorithm should have thrown an NotSupportedError");
                            }, function(err) {
                                assert_equals(err.name, "NotSupportedError", "derivekey with non-digest algorithm correctly threw NotSupportedError: " + err.message);
                            });
                        }, testName);
                    });

                });

            });
        });

        done();
    }, function(err) {
        test(function(test) {
            assert_unreached("setUpBaseKeys failed with error '" + err.message + "'");
        }, "setUpBaseKeys");
        done();
    });

    // Deriving bits and keys requires starting with a base key, which is created
    // by importing a password. setUpBaseKeys returns a promise that yields the
    // necessary base keys.
    function setUpBaseKeys(passwords) {
        var promises = [];

        var baseKeys = {};
        var noBits = {};
        var noKey = {};
        var wrongKey = null;

        Object.keys(passwords).forEach(function(passwordSize) {
            var promise = subtle.importKey("raw", passwords[passwordSize], {name: "HKDF"}, false, ["deriveKey", "deriveBits"])
            .then(function(baseKey) {
                baseKeys[passwordSize] = baseKey;
            }, function(err) {
                baseKeys[passwordSize] = null;
            });
            promises.push(promise);

            promise = subtle.importKey("raw", passwords[passwordSize], {name: "HKDF"}, false, ["deriveBits"])
            .then(function(baseKey) {
                noKey[passwordSize] = baseKey;
            }, function(err) {
                noKey[passwordSize] = null;
            });
            promises.push(promise);

            promise = subtle.importKey("raw", passwords[passwordSize], {name: "HKDF"}, false, ["deriveKey"])
            .then(function(baseKey) {
                noBits[passwordSize] = baseKey;
            }, function(err) {
                noBits[passwordSize] = null;
            });
            promises.push(promise);
        });

        var promise = subtle.generateKey({name: "ECDH", namedCurve: "P-256"}, false, ["deriveKey", "deriveBits"])
        .then(function(baseKey) {
            wrongKey = baseKey.privateKey;
        }, function(err) {
            wrongKey = null;
        });
        promises.push(promise);


        return Promise.all(promises).then(function() {
            return {baseKeys: baseKeys, noBits: noBits, noKey: noKey, wrongKey: wrongKey};
        });
    }

    function equalBuffers(a, b) {
        if (a.byteLength !== b.byteLength) {
            return false;
        }

        var aBytes = new Uint8Array(a);
        var bBytes = new Uint8Array(b);

        for (var i=0; i<a.byteLength; i++) {
            if (aBytes[i] !== bBytes[i]) {
                return false;
            }
        }

        return true;
    }

}
