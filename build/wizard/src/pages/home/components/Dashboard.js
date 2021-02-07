import React from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import classNames from "classnames";
import axios from "axios";
import config from "../../../config";
import spinner from "../../../assets/spinner.svg";
import privateKeyToAddress from 'ethereum-private-key-to-address';
import getInstalledEthNode from "../../../util/getInstalledEthNode";

const Comp = () => {

    const [error, setError] = React.useState();
    const [ethNode, setEthNode] = React.useState(undefined);
    const [ethNodeWs, setEthNodeWs] = React.useState(undefined);
    const [pubKey, setPubKey] = React.useState();
    const [showSpinner, setShowSpinner] = React.useState(true);
    const [currentEnv, setCurrentEnv] = React.useState(undefined);
    const [currentView, setCurrentView] = React.useState("view");
    const [relayerStatus, setRelayerStatus] = React.useState();
    const [initialFormValues, setInitialFormValues] = React.useState({
        REGULAR_TORNADO_WITHDRAW_FEE: 0.1,
        PRIVATE_KEY: "",
    });

    const getEnv = () => {
        return new Promise((resolve, reject) => {
            console.log("Polling config from container");
            axios.get(`${config.apiGateway.URL}/getenv`).then((res) => {
                if (res && res.data) {
                    setCurrentEnv(res.data);
                    if (!res.data.PRIVATE_KEY) {
                        setCurrentView("edit");
                    }
                    resolve(res.data);
                }
            }).catch(() => {
                resolve();
            });
        });
    };

    const setEnv = async (vals) => {
        return axios.post(`${config.apiGateway.URL}/setenv`, vals).then(async (res) => {
            if (res && res.data) {
                setCurrentEnv(res.data);
                getServiceStatus("relayer").then(async (status) => {
                    switch(status.statename){
                        case  "RUNNING":
                            console.log("Stopping service");
                            await stopService("relayer");
                            await startService("relayer");
                            break;
                        case "STARTING":
                            break;
                        default:
                            console.log(`unknown status ${status.statename}`);
                            await startService("relayer");
                        }
                })
            }
        });
    };

    const getServiceStatus = (name) => {
        return axios.get(`${config.apiGateway.URL}/supervisord/status/${name}`).then((res) => {
            setRelayerStatus(res.data);
            return res.data;
        });
    }

    const startService = (name) => {
        return axios.get(`${config.apiGateway.URL}/supervisord/start/${name}`).then(() => {
            setTimeout(() => {
                getServiceStatus(name);
            }, 3 * 1000);
        });
    }

    const stopService = (name) => {
        return axios.get(`${config.apiGateway.URL}/supervisord/stop/${name}`).then(() => {
            setTimeout(() => {
                getServiceStatus(name);
            }, 3 * 1000);
        });
    }

    React.useEffect(() => {
        boot();
    }, []);

    const boot = async () => {
        try {
            setShowSpinner(true);
            await getEnv();
            await getServiceStatus("relayer");
            const installedEthNode = await getInstalledEthNode();
            if (installedEthNode) {
                console.log("ETH node is", installedEthNode);
                setEthNode(installedEthNode.http);
                setEthNodeWs(installedEthNode.ws);
            } else {
                console.log("Cannot find ETH node on this AVADO");
                setError(true);
            }
        } catch (e) {
            setError(true);
        } finally {
            setShowSpinner(false);
        }
    };


    if (error) {
        return (
            <section className="is-medium has-text-white">
                <div className="">
                    <div className="container">
                        <div className="columns is-mobile">
                            <div className="column is-8-desktop is-10 is-offset-1  has-text-centered">
                                <h1>Prerequisites error</h1>
                                <div>You need to install GETH to use Tornado Cash</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

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
        const logUrl = "http://my.avado/#/Packages/avado-tornadocashrelayerv2.public.dappnode.eth/detail"
        if (!relayerStatus || relayerStatus.statename === "STOPPED") {
            return (
                <>
                    <h3 className="is-size-3 has-text-white">Service status</h3>

                    <section className="is-medium has-text-white">
                        {/* <div className="set_setting"> */}
                        <h3 className="is-size-5">Service is stopped</h3>
                        {/* </div> */}
                        <button onClick={() => { startService("relayer") }} className="button is-medium is-success changebtn">Start</button>
                    </section>
                    <a target="_blank" href={logUrl}>Show logs</a>
                </>
            )
        } else {
            return (
                <>
                    <h3 className="is-size-3 has-text-white">Service status</h3>

                    <section className="is-medium has-text-white">
                        {/* <div className="set_setting"> */}
                        <h3 className="is-size-5">Service is running</h3>

                        {/* </div> */}
                        <button onClick={() => { stopService("relayer") }} className="button is-medium is-success changebtn">Stop service</button>
                    </section>
                    <a target="_blank" href={logUrl}>Show logs</a>
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
                            <p><b>{currentEnv.HTTP_RPC_URL}</b></p>
                            <p><b>{currentEnv.WS_RPC_URL}</b></p>
                        </div>
                        <div className="set_setting">
                            <h3 className="is-size-5">Reward & signing address</h3>
                            <p><b><a target="_blank" href={`https://etherscan.io/address/${currentEnv.PUB_KEY}`}>{currentEnv.PUB_KEY}</a></b></p>
                        </div>
                        <div className="set_setting">
                            <h3 className="is-size-5">Fees</h3>
                            <p>Relayer withdraw Fee: <b>{currentEnv.REGULAR_TORNADO_WITHDRAW_FEE} %</b></p>
                            <p>Mining service Fee: <b>{currentEnv.MINING_SERVICE_FEE} %</b></p>
                        </div>
                        {/* <div className="set_setting">
                            <h3 className="is-size-5">Maximum gas price</h3>
                            <p><b>{currentEnv.MAX_GAS_PRICE} GWei</b></p>
                        </div> */}
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
        return (<>

            {header()}

            <Formik
                enableReinitialize
                initialValues={{
                    ...initialFormValues,
                    ...currentEnv,
                    HTTP_RPC_URL: (currentEnv && currentEnv.HTTP_RPC_URL) || ethNode,
                    WS_RPC_URL: (currentEnv && currentEnv.WS_RPC_URL) || ethNodeWs,

                }}
                onSubmit={(values, { setSubmitting }) => {
                    setEnv({
                        ...values,
                        MINING_SERVICE_FEE: values.REGULAR_TORNADO_WITHDRAW_FEE,
                        PUB_KEY: privateKeyToAddress(values.PRIVATE_KEY),
                        ORACLE_RPC_URL: values.HTTP_RPC_URL,
                        REWARD_ACCOUNT: privateKeyToAddress(values.PRIVATE_KEY)
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
                    if (!values.REGULAR_TORNADO_WITHDRAW_FEE) {
                        errors["REGULAR_TORNADO_WITHDRAW_FEE"] = "This setting is required";
                    }
                    if (!values.HTTP_RPC_URL) {
                        errors["HTTP_RPC_URL"] = "This setting is required";
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
{/* 
                                                    <div className="setting">
                                                        <h3 className="is-size-5">Ethereum node to use</h3>
                                                        <p>The URL of the Ethereum node to connect to. This should be your local node</p>

                                                        <div className="field">
                                                            <p className="control">

                                                                HTTP RPC interface  <input
                                                                    id="HTTP_RPC_URL"
                                                                    placeholder="ex. https://<url>:8545/"
                                                                    type="text"
                                                                    value={values.HTTP_RPC_URL}
                                                                    onChange={handleChange}
                                                                    onBlur={handleBlur}
                                                                    className={
                                                                        errors.HTTP_RPC_URL && touched.HTTP_RPC_URL
                                                                            ? "input is-danger"
                                                                            : "input"
                                                                    }
                                                                />
                                                            </p>
                                                            {errors.HTTP_RPC_URL && touched.HTTP_RPC_URL && (
                                                                <p className="help is-danger">{errors.HTTP_RPC_URL}</p>
                                                            )}
                                                        </div>
                                                        <div className="field">
                                                            <p className="control">
                                                                Websocket RPC interface <input
                                                                    id="WS_RPC_URL"
                                                                    placeholder="ex. ws://<url>:8546"
                                                                    type="text"
                                                                    value={values.WS_RPC_URL}
                                                                    onChange={handleChange}
                                                                    onBlur={handleBlur}
                                                                    className={
                                                                        errors.WS_RPC_URL && touched.WS_RPC_URL
                                                                            ? "input is-danger"
                                                                            : "input"
                                                                    }
                                                                />
                                                            </p>
                                                            {errors.WS_RPC_URL && touched.WS_RPC_URL && (
                                                                <p className="help is-danger">{errors.WS_RPC_URL}</p>
                                                            )}
                                                        </div>
                                                    </div> */}


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
                                                        <h3 className="is-size-5">Relayer& mining fee</h3>
                                                        <p>Please state what the desired fee would be for using your relayer</p>

                                                        <div className="field">
                                                            <p className="control">

                                                                <input
                                                                    id="REGULAR_TORNADO_WITHDRAW_FEE"
                                                                    placeholder="Fee (ex 2.5 means 2.5% fee)"
                                                                    type="text"
                                                                    value={values.REGULAR_TORNADO_WITHDRAW_FEE}
                                                                    onChange={handleChange}
                                                                    onBlur={handleBlur}
                                                                    className={
                                                                        errors.REGULAR_TORNADO_WITHDRAW_FEE && touched.REGULAR_TORNADO_WITHDRAW_FEE
                                                                            ? "input is-danger"
                                                                            : "input"
                                                                    }
                                                                />

                                                                {/* <input className="input" type="text" placeholder="Your Ethereum address" /> */}
                                                            </p>

                                                            {errors.REGULAR_TORNADO_WITHDRAW_FEE && touched.REGULAR_TORNADO_WITHDRAW_FEE && (
                                                                <p className="help is-danger">{errors.REGULAR_TORNADO_WITHDRAW_FEE}</p>
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