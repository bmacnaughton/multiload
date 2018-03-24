ARG=$1
PARAM=$2




if [[ -z "$ARG" ]]; then
    echo "source this script to execute various sometimes useful actions"
    echo
elif [[ "$ARG" = "server" ]]; then
    echo "show the server's environment variables:"
    if [[ -z "$PARAM" ]]; then
        echo "must supply the server pid"
        return
    else
        xargs --null --max-args=1 < /proc/$PARAM/environ
    fi
elif [[ "$ARG" = "somefunc" ]]; then
    echo "doing something I think"
    if [[ -z "$PARAM" ]]; then

    elif [[ "$PARAM" = "valid-param" ]]; then

    else
        echo Invalid parameter "$PARAM" for argument "scribe"
    fi
elif [[ "$ARG" = "help" ]]; then
    echo "help is not implemented here and unevently in multiload.js."
    echo "read the code for details."
    echo
    echo "multiload.js creates various loads on the server. it is"
    echo "intended to make it a more pluggable framework."
else
    echo "ERROR $ARG invalid"
fi

return
