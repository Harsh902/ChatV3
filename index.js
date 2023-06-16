const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const port = process.env.PORT || 3000
const { Server } = require("socket.io");
const path = require("path");

app.use(cors());
app.use(express.static(path.join(__dirname, "build")))
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"))
})
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origins: [""],
        handlePreflightRequest: (req, res) => {
            res.writeHeader(200, {
                "Access-Control-Allow-Origin": ""
            })
            res.end()
        }
    },
    credentials: true
})

io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on("send_message", (data) =>{
        console.log(data);
        const answerMessage = {
            author: "bot",
            message: "Hi",
            time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes()
        };
        socket.emit("receive_message", answerMessage);
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected", socket.id);
    });
});

server.listen(port, () => {
    console.log("SERVER RUNNING");
});
