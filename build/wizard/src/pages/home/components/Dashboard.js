import React from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import classNames from "classnames";
import axios from "axios";
import spinner from "../../../assets/spinner.svg";
import privateKeyToAddress from 'ethereum-private-key-to-address';
import getInstalledEthNode from "../../../util/getInstalledEthNode";

const dcloudmonitorAPI = "" ;
//const dcloudmonitorAPI ="http://my.avado-tornadocashrelayer.public.dappnode.eth:82";

const Comp = () => {

    const [ethNode, setEthNode] = React.useState(undefined);
    const [pubKey, setPubKey] = React.useState();
    const [showSpinner, setShowSpinner] = React.useState(true);
    const [currentEnv, setCurrentEnv] = React.useState(undefined);
    const [currentView, setCurrentView] = React.useState("view");
    const [relayerStatus, setRelayerStatus] = React.useState();
    const [initialFormValues, setInitialFormValues] = React.useState({
        RELAYER_FEE: 0.1,
        PRIVATE_KEY: "",
        NET_ID: 1,
        REDIS_URL: "redis://127.0.0.1:6379",
        APP_PORT: 8000
    });

    const getEnv = () => {
        setShowSpinner(true);
        return new Promise((resolve, reject) => {
            console.log("Polling config from container");
            axios.get(`${dcloudmonitorAPI}/getenv`).then((res) => {
                if (res && res.data) {
                    setCurrentEnv(res.data);
                    setShowSpinner(false);
                    if (!res.data.PRIVATE_KEY) {
                        setCurrentView("edit");
                    }
                    resolve(res.data);
                }
            }).catch(() => {
                // reject();
                resolve();
            });
        });
    };

    const setEnv = (vals) => {
        setShowSpinner(true);
        return axios.post(`${dcloudmonitorAPI}/setenv`, vals).then((res) => {
            if (res && res.data) {
                setCurrentEnv(res.data);

                getServiceStatus("relayer").then((status) => {
                    if (status.statename === "RUNNING") {
                        console.log("Stopping service");
                        stopService("relayer").then(() => {
                            console.log("Starting service");
                            startService("relayer");
                        })
                    }
                })
                setShowSpinner(false);
            }
        });
    };

    const getServiceStatus = (name) => {
        return axios.get(`${dcloudmonitorAPI}/supervisord/status/${name}`).then((res) => {
            setRelayerStatus(res.data);
            return res.data;
        });
    }

    const startService = (name) => {
        return axios.get(`${dcloudmonitorAPI}/supervisord/start/${name}`).then(() => {
            setTimeout(() => {
                getServiceStatus(name);
            }, 3 * 1000);
        });
    }

    const stopService = (name) => {
        return axios.get(`${dcloudmonitorAPI}/supervisord/stop/${name}`).then(() => {
            setTimeout(() => {
                getServiceStatus(name);
            }, 3 * 1000);
        });
    }

    React.useEffect(() => {
        getEnv();
        getServiceStatus("relayer");
        getInstalledEthNode().then((installedEthNode) => {
            console.log("ETH node is", installedEthNode);
            setEthNode(installedEthNode);
        }).catch((e) => {
            console.log("ETH node not found", e);
        });

    }, []);


    // Checkbox input
    const Checkbox = ({
        field: { name, value, onChange, onBlur },
        form: { errors, touched, setFieldValue },
        id,
        label,
        className,
        ...props
    }) => {
        return (
            <div>
                <input
                    name={name}
                    id={id}
                    type="checkbox"
                    value={value}
                    checked={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    className={classNames("radio-button", className)}
                />
                <label htmlFor={id}>{label}</label>
                {/* {touched[name] && <InputFeedback error={errors[name]} />} */}
            </div>
        );
    };


    if (showSpinner) {
        return (
            <section className="is-medium has-text-white">
                <div className="">
                    <div className="container">
                        <div className="columns is-mobile">
                            <div className="column is-8-desktop is-10 is-offset-1  has-text-centered">
                                <p className="is-size-5 has-text-weight-bold">Loading</p>
                                <div className="spacer"></div>
                                <img alt="spinner" src={spinner} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    const serviceStatus = (name) => {
        const logUrl = "http://my.avado/#/Packages/avado-tornadocashrelayer.public.dappnode.eth/detail"
        if (!relayerStatus || relayerStatus.statename === "STOPPED") {
            return (
                <>
                    <h3 className="is-size-3 has-text-white">Service status</h3>

                    <section className="is-medium has-text-white">
                        <div className="set_setting">
                            <h3 className="is-size-5">Service is stopped</h3>
                        </div>
                        <button onClick={() => { startService("relayer") }} className="button is-medium is-success changebtn">Start</button>
                    </section>
                    <a href={logUrl}>Show logs</a>
                </>
            )
        } else {
            return (
                <>
                    <h3 className="is-size-3 has-text-white">Service status</h3>

                    <section className="is-medium has-text-white">
                        <div className="set_setting">
                            <h3 className="is-size-5">Service is running</h3>

                        </div>
                        <button onClick={() => { stopService("relayer") }} className="button is-medium is-success changebtn">Stop service</button>
                    </section>
                    <a href={logUrl}>Show logs</a>
                </>
            )
        }
    }


    const header = () => {
        return (
            <section className="is-medium has-text-white">
                <div className="columns is-mobile">
                    <div className="column is-8-desktop is-10">
                        <h1 className="title is-1 is-spaced has-text-white">Tornadocash relayer</h1>
                    </div>
                </div>
                <p className="">Relayer service for TornadoCash. You can use your own relayer - or provide relay service to other people through the AVADO RYO cloud.</p>
            </section>
        )
    }

    if (currentView === "view") {
        if (currentEnv) {
            return (
                <>
                    {header()}
                    <h3 className="is-size-3 has-text-white">Settings</h3>

                    <section className="is-medium has-text-white">
                    <div className="set_setting">
                            <h3 className="is-size-5">ETH node to use</h3>
                            <p><b>{currentEnv.RPC_URL}</b></p>
                        </div>
                        <div className="set_setting">
                            <h3 className="is-size-5">Reward & signing address</h3>
                            <p><b><a href={`https://etherscan.io/address/${currentEnv.PUB_KEY}`}>{currentEnv.PUB_KEY}</a></b></p>
                        </div>
                        <div className="set_setting">
                            <h3 className="is-size-5">Relayer Fee</h3>
                            <p><b>{currentEnv.RELAYER_FEE} %</b></p>
                        </div>
                        <a onClick={() => { setCurrentView("edit"); }} className="button is-medium is-success changebtn">Change settings</a>
                    </section>

                    {serviceStatus()}

                </>
            )
        } else {
            console.log("Dont have a config");
            setCurrentView("edit");
        }
    }

    if (currentView === "edit") {
console.log("Form: ethNode",ethNode);
        return (<>

            {header()}

            <Formik
                enableReinitialize
                initialValues={{
                    ...initialFormValues,
                    ...currentEnv,
                    RPC_URL: (currentEnv && currentEnv.RPC_URL) || ethNode,
                }}
                onSubmit={(values, { setSubmitting }) => {
                    setEnv({
                        ...values
                        , PUB_KEY: privateKeyToAddress(values.PRIVATE_KEY),
                        ORACLE_RPC_URL: values.RPC_URL
                    }).then(() => {
                        setSubmitting(false);
                        setCurrentView("view");
                    });
                }}
                validate={(values) => {
                    let errors = {};

                    if (!values.PRIVATE_KEY || values.PRIVATE_KEY.length !== 64) {
                        if (!values.PRIVATE_KEY) {
                            errors["PRIVATE_KEY"] = "This setting is required";
                        } else {
                            errors["PRIVATE_KEY"] = "not a valid private key";
                        }
                    } else {
                        setPubKey(privateKeyToAddress(values.PRIVATE_KEY));
                    }
                    if (!values.RELAYER_FEE) {
                        errors["RELAYER_FEE"] = "This setting is required";
                    }
                    if (!values.RPC_URL) {
                        errors["RPC_URL"] = "This setting is required";
                    }

                    return errors;
                }}

            >
                {props => {
                    const {
                        values,
                        touched,
                        errors,
                        dirty,
                        isSubmitting,
                        handleChange,
                        handleBlur,
                        handleSubmit,
                        handleReset,
                        setFieldValue,
                        submitForm
                    } = props;
                    return (
                        <>
                            <form onSubmit={handleSubmit}>
                                <section className="is-medium has-text-white">
                                    <div className="">
                                        <div className="container">
                                            <div className="columns is-mobile">
                                                <div className="column is-8-desktop is-10">

                                                    <div className="setting">
                                                        <h3 className="is-size-5">Ethereum node to use</h3>
                                                        <p>The URL of the Ethereum node to connect to. This should be your local node</p>

                                                        <div className="field">
                                                            <p className="control">

                                                                <input
                                                                    id="RPC_URL"
                                                                    placeholder="ex. https://<url>:8545/"
                                                                    type="text"
                                                                    value={values.RPC_URL}
                                                                    onChange={handleChange}
                                                                    onBlur={handleBlur}
                                                                    className={
                                                                        errors.RPC_URL && touched.RPC_URL
                                                                            ? "input is-danger"
                                                                            : "input"
                                                                    }
                                                                />

                                                                {/* <input className="input" type="text" placeholder="Your Ethereum address" /> */}
                                                            </p>

                                                            {errors.RPC_URL && touched.RPC_URL && (
                                                                <p className="help is-danger">{errors.RPC_URL}</p>
                                                            )}


                                                        </div>
                                                    </div>


                                                    <div className="setting">
                                                        <h3 className="is-size-5">Signing key</h3>
                                                        <p>Note: This key will be saved on your AVADO's disk. Make sure it does not contain a lot of crypto. Just enough ETH to pay for the relay transactions.</p>
                                                        <div className="field">
                                                            <p className="control">

                                                                <input
                                                                    id="PRIVATE_KEY"
                                                                    placeholder="Private key"
                                                                    type="password"
                                                                    value={values.PRIVATE_KEY}
                                                                    onChange={handleChange}
                                                                    onBlur={handleBlur}
                                                                    className={
                                                                        errors.PRIVATE_KEY && touched.PRIVATE_KEY
                                                                            ? "input is-danger"
                                                                            : "input"
                                                                    }
                                                                />
                                                            </p>
                                                            {pubKey && (<span>Pubkey:{pubKey}</span>)}
                                                            {errors.PRIVATE_KEY && touched.PRIVATE_KEY && (
                                                                <p className="help is-danger">{errors.PRIVATE_KEY}</p>
                                                            )}

                                                        </div>
                                                    </div>


                                                    <div className="setting">
                                                        <h3 className="is-size-5">Relayer fee</h3>
                                                        <p>Please state what the desired fee would be for using your relayer</p>

                                                        <div className="field">
                                                            <p className="control">

                                                                <input
                                                                    id="RELAYER_FEE"
                                                                    placeholder="Fee (ex 2.5 means 2.5% fee)"
                                                                    type="text"
                                                                    value={values.RELAYER_FEE}
                                                                    onChange={handleChange}
                                                                    onBlur={handleBlur}
                                                                    className={
                                                                        errors.RELAYER_FEE && touched.RELAYER_FEE
                                                                            ? "input is-danger"
                                                                            : "input"
                                                                    }
                                                                />

                                                                {/* <input className="input" type="text" placeholder="Your Ethereum address" /> */}
                                                            </p>

                                                            {errors.RELAYER_FEE && touched.RELAYER_FEE && (
                                                                <p className="help is-danger">{errors.RELAYER_FEE}</p>
                                                            )}


                                                        </div>
                                                    </div>


                                                    {/* <div className="setting">
                                                            <h3 className="is-size-5">Enter your AVADO NFT address</h3>
                                                            <p>Please provide the public key of the NFT card in your AVADO box to participate in the reward pool. </p>
                                                            <div className="field">
                                                                <p className="control">
                                                                    <input
                                                                        id="nftpubkey"
                                                                        placeholder="Your AVADO NFT address"
                                                                        type="text"
                                                                        value={values.nftpubkey}
                                                                        onChange={handleChange}
                                                                        onBlur={handleBlur}
                                                                        className={
                                                                            errors.nftpubkey && touched.nftpubkey
                                                                                ? "input is-danger"
                                                                                : "input"
                                                                        }
                                                                    />
                                                                </p>
                                                                {errors.nftpubkey && touched.nftpubkey && (
                                                                    <p className="help is-danger">{errors.nftpubkey}</p>
                                                                )}
                                                            </div>
                                                        </div> */}


                                                    {/* <div className="setting">
                                                            <h3 className="is-size-5">Do you agree with the <a href="https://ava.do/ryo-terms-conditions/">Terms and Conditions of the AVADO RYO-Cloud</a></h3>
                                                            <nav className="level switch_w_options">
                                                                <div className="level-left">

                                                                    <div className="level-item">
                                                                        <div className="field">

                                                                            <Field
                                                                                component={Checkbox}
                                                                                name="agreetandc"
                                                                                id="agreetandc"
                                                                                label={values.agreetandc ? "Yes" : "No"}
                                                                                className="switch is-rounded is-link"
                                                                            />

                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </nav>

                                                            {errors.agreetandc && touched.agreetandc && (
                                                                <p className="help is-danger">{errors.agreetandc}</p>
                                                            )}

                                                        </div> */}


                                                    <div className="field is-grouped buttons">

                                                        <p className="control">
                                                            <a disabled={isSubmitting} onClick={() => { submitForm(); }} className="button is-medium is-success">Save and start package</a>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </form>

                        </>

                    );
                }}
            </Formik>


        </>);
    }

    return null;
};

export default Comp;