const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { exec } = require("child_process");
const { constants } = require("buffer");
const { DEFAULT_PUBLISHINGPROFILE_URL } = require("azure-cli/lib/util/constants");
const { findSourceMap } = require("module");
const { futimes } = require("fs");
const questions = require("./wineQuestionsAnswers.json")

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    }
})

let userAnswers = []

let number_of_attemps = 0
let questionIndex = 0
io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    const welcomeMessage = {
        author: "bot",
        message: "Welcome To Wine Bot \nAlways remember, Life is too short for bad wine!"
    };
    const helpMessage = {
        author: "bot",
        message: "Enter idk if you cannot answer a question.\nYou can enter no if you would not like to answer a question."
    }; 
    const askName = {
        author: questions.questions[questionIndex].author,
        message: questions.questions[questionIndex].question
    }
    socket.emit("receive_message", welcomeMessage)
    socket.emit("receive_message", helpMessage)
    socket.emit("receive_message", askName)
    socket.on("send_message", (data) =>{
        data.message = data.message.trim()
        data.message = data.message.replaceAll(/\s+/g," ")
        data.message = data.message.toLowerCase()
        if(questionIndex < questions.questions.length)
        {
            if(data.message === "idk" || data.message === "no")
            {
                const answerMessage = {
                    author : questions.questions[questionIndex].author,
                    message : "No problem! we move on to the next question."
                }
                userAnswers[questionIndex] = 0
                console.log(userAnswers)
                socket.emit("receive_message", answerMessage)
                questionIndex++
                const questionMessage = {
                    author : questions.questions[questionIndex].author,
                    message : questions.questions[questionIndex].question
                }
                socket.emit("receive_message",  questionMessage)
            }
            else
            {
                data.message = data.message.trim()
                data.message = data.message.replaceAll(/\s+/g," ")
                //exceptional case for percentages, since we remove all symbols, we need to replace % with percent
                //so that our keyword spotting works.
                //if a user puts that accidently, it does not matter as long as they have other keywords.
                if(data.message.includes("%"))
                {
                    data.message = data.message.replaceAll("%", " percent")
                }
                data.message = data.message.replaceAll(/[^\w ]+/g,"")
                data.message = data.message.toLowerCase() 
                let answer =data.message.split(" ")
                ansIndex = keywordSpotting(data.message,  questions.questions[questionIndex].phrases)
                if(ansIndex === -1)
                {
                    //we return -1 when keyword spotting fails, thus we increment the number of attempts
                    //the user is taking to answer the question, if they cannot answer properly, we will restart.
                    number_of_attemps++
                    if(number_of_attemps > 3)
                    {
                        const answerMessage = {
                            author : questions.questions[questionIndex].author,
                            message : "Due to repeated failed attempts, the bot will restart. \nThank you for your cooperation."
                        }
                        socket.emit("receive_message", answerMessage)
                        questionIndex = 0
                        const questionMessage = {
                            author : questions.questions[questionIndex].author,
                            message : questions.questions[questionIndex].question
                        }
                        socket.emit("receive_message",  questionMessage)
                    }
                    else{
                            const answerMessage = {
                                author : questions.questions[questionIndex].author,
                                message : "Sadly, I couldn't understand that. \nCan you try answering it differently?"
                            }
                        socket.emit("receive_message", answerMessage)
                        const questionMessage = {
                            author : questions.questions[questionIndex].author,
                            message : questions.questions[questionIndex].question
                        }
                        socket.emit("receive_message",  questionMessage)  
                        }
                }
                else{
                    const answerMessage = {
                            author : questions.questions[questionIndex].author,
                            message : "You answered: " + answer[keywordSpotting(data.message, questions.questions[questionIndex].phrases)]
                        }
                    userAnswers[questionIndex] = answer[keywordSpotting(data.message, questions.questions[questionIndex].phrases)]
                    console.log(userAnswers)
                    socket.emit("receive_message", answerMessage)
                    questionIndex++
                        const questionMessage = {
                            author : questions.questions[questionIndex].author,
                            message : questions.questions[questionIndex].question
                        }
                    socket.emit("receive_message",  questionMessage)
                }
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected", socket.id);
    });
});

server.listen(3001, () => {
    console.log("SERVER RUNNING");
});

//How this works:
// I split the user's message into an array of words
// For each particular question, there is a list of keywords that are correct.
// Sometimes the keywords are larger than 1, if that is the case, I form groups of words and compare 
// those to the keywords. For example, if a sentence has 4 words, and the keyphrase is 2 words long
// I compare the words in this format: 0,1 1,2 2,3 3,4 - These numbers correspond to the index of the words in the user's answer.
function keywordSpotting(message, ...phrases)
{
    messageArray = message.split(" ")
    console.log(messageArray)
    console.log(messageArray.length)
    let phraseNumber = 0
    if (messageArray.length > 1)
    {
        for(var i = 0;i < phrases[0].length;i++)
        {
            let phr = phrases[0][i].split(" ")
            if(phr.length <= message.length)
            {
                for(var j = 0;j < (messageArray.length - phr.length);j++)
                {
                    let phrToCom= ""
                    for(var k = 0; k <=(phr.length+j);k++)
                    {
                        phrToCom += messageArray[k] + " "
                    }
                    console.log(phrToCom + " user phrase")
                    console.log(phrases[0][i] + " keyword phrase")
                    if(phrToCom.includes(phrases[0][i]))
                    {
                        //sometimes, a phrase is arranged in such a way that the answer is BEFORE the phrase
                        //so we accommodate for that here.
                        if(phraseNumber >= questions.questions[questionIndex].answerBeforePhraseIndex)
                        {
                            console.log(j+phr.length + " index of answer")
                            return j+phr.length
                        }
                        else{

                            return j
                        }
                        //return j+phr.length                  
                    }
                }
            }
            phraseNumber++
        }
        return -1
    }
    else if(messageArray.length === 1)
    {
        for(var i = 0;i < phrases[0].length;i++)
        {
            if(messageArray.includes(phrases[0][i]))
            {
                return 0
            }   
        }
        return -1
    }
    else
    {
        return -1
    }
}
