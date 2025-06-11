import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useSearchParams,
} from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Fade from "@mui/material/Fade";
import Slide from "@mui/material/Slide";
import Divider from "@mui/material/Divider";
import axios from "axios";

// Create theme with enhanced styling
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
      light: "#42a5f5",
      dark: "#1565c0",
    },
    secondary: {
      main: "#dc004e",
      light: "#ff4081",
      dark: "#c51162",
    },
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
      marginBottom: "1rem",
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
          padding: "8px 24px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        },
      },
    },
  },
});

// Assessment framework data
const assessmentFramework = {
  framework: "Five Practices of Exemplary Leadership",
  scale: {
    type: "Likert",
    options: [
      { value: 1, label: "Strongly Disagree" },
      { value: 2, label: "Disagree" },
      { value: 3, label: "Neutral" },
      { value: 4, label: "Agree" },
      { value: 5, label: "Strongly Agree" },
    ],
  },
  practices: [
    {
      id: "model_the_way",
      name: "Model the Way",
      questions: [
        "The leader clearly communicates core values that guide decisions and behavior.",
        "The leader sets an example by aligning actions with stated values.",
        "The leader is consistent and dependable in everyday behavior.",
        "The leader acts with integrity even under pressure.",
        "The leader takes responsibility for mistakes and owns outcomes.",
        "The leader makes values-based decisions, even when difficult.",
      ],
    },
    {
      id: "inspire_a_shared_vision",
      name: "Inspire a Shared Vision",
      questions: [
        "The leader expresses a compelling vision of the future.",
        "The leader helps others understand how their work contributes to a bigger goal.",
        "The leader creates enthusiasm around a shared direction.",
        "The leader talks about possibilities more than problems.",
        "The leader encourages others to imagine what they can achieve together.",
        "The leader builds alignment around long-term goals.",
      ],
    },
    {
      id: "challenge_the_process",
      name: "Challenge the Process",
      questions: [
        "The leader looks for ways to improve existing processes and systems.",
        "The leader encourages experimentation and learning from mistakes.",
        "The leader questions the status quo when needed.",
        "The leader supports others in trying new approaches.",
        "The leader takes calculated risks to advance progress.",
        "The leader learns from setbacks and adapts quickly.",
      ],
    },
    {
      id: "enable_others_to_act",
      name: "Enable Others to Act",
      questions: [
        "The leader fosters a culture of collaboration and mutual support.",
        "The leader trusts team members to make decisions.",
        "The leader encourages professional development and growth.",
        "The leader shares information openly to build confidence.",
        "The leader treats others with respect and dignity.",
        "The leader builds strong, cooperative relationships across the team.",
      ],
    },
    {
      id: "encourage_the_heart",
      name: "Encourage the Heart",
      questions: [
        "The leader acknowledges individual and team achievements.",
        "The leader celebrates milestones and progress.",
        "The leader gives regular, sincere feedback and praise.",
        "The leader shows appreciation in meaningful ways.",
        "The leader creates a sense of pride and belonging in the team.",
        "The leader expresses genuine care and encouragement.",
      ],
    },
  ],
  open_ended: [
    "What is one thing this leader does particularly well?",
    "What is one area where this leader could improve?",
  ],
};

// Flatten questions for easier navigation
const allQuestions = [
  ...assessmentFramework.practices.flatMap((practice) =>
    practice.questions.map((question) => ({
      id: `${practice.id}_${practice.questions.indexOf(question)}`,
      practice: practice.name,
      text: question,
      type: "rating",
    }))
  ),
  ...assessmentFramework.open_ended.map((question, index) => ({
    id: `open_${index}`,
    text: question,
    type: "open_ended",
  })),
];

// Assessment component
const Assessment: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = React.useState(0);
  const [responses, setResponses] = React.useState<Record<string, string>>({});
  const [assessmentId, setAssessmentId] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [rating, setRating] = React.useState<number | null>(null);
  const [openResponse, setOpenResponse] = React.useState("");
  const [type, setType] = React.useState<"leader" | "rater" | null>(null);

  React.useEffect(() => {
    const leaderToken = searchParams.get("leader_token");
    const raterToken = searchParams.get("rater_token");
    const type_param = searchParams.get("type");
    console.log("type_param", type_param);
    setType(type_param as "leader" | "rater");

    if (!leaderToken || !raterToken) {
      setError("Missing required tokens");
      setLoading(false);
      return;
    }

    // Start assessment
    const startAssessment = async () => {
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/api/assessment/start`,
          {
            encrypted_leader_identifier: leaderToken,
            encrypted_rater_identifier: raterToken,
          },
          { params: { token: raterToken } } // Using rater token for validation
        );
        setAssessmentId(response.data.assessmentId);
        setLoading(false);
      } catch (err) {
        setError("Failed to start assessment");
        setLoading(false);
      }
    };

    startAssessment();
  }, [searchParams]);

  // Modify questions based on role
  const getModifiedQuestion = (question: string) => {
    if (!type) return question;

    if (type === "leader") {
      // Handle different grammatical structures
      return (
        question
          // Handle "The leader is" pattern
          .replace(/^The leader is/, "You are")
          // Handle "The leader" + verb pattern
          .replace(
            /^The leader (clearly |actively |effectively |)?([a-z]+s) /,
            (_, adverb, verb) => {
              // Convert third person singular to first person
              const baseVerb = verb.replace(/s$/, "");
              return `You ${adverb || ""}${baseVerb} `;
            }
          )
      );
    } else {
      // Handle different grammatical structures
      return (
        question
          // Handle "You are" pattern
          .replace(/^You are/, "The leader is")
          // Handle "You" + verb pattern
          .replace(
            /^You (clearly |actively |effectively |)?([a-z]+) /,
            (_, adverb, verb) => {
              // Convert first person to third person singular
              const thirdPersonVerb = verb.endsWith("s") ? verb : verb + "s";
              return `The leader ${adverb || ""}${thirdPersonVerb} `;
            }
          )
      );
    }
  };

  const handleResponse = async (response: string) => {
    const questionId = allQuestions[currentQuestion].id;
    const updatedResponses = { ...responses, [questionId]: response };
    setResponses(updatedResponses);

    if (currentQuestion < allQuestions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setRating(null);
      setOpenResponse("");
    } else {
      setLoading(true);
      try {
        await axios.post(
          `${process.env.REACT_APP_API_URL}/api/assessment/submit`,
          {
            assessmentId,
            responses: Object.entries(updatedResponses).map(
              ([questionId, response]) => ({
                questionId,
                response,
              })
            ),
          },
          { params: { token: searchParams.get("rater_token") } }
        );
        setSubmitted(true);
        setLoading(false);
      } catch (err) {
        setError("Failed to submit assessment");
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Processing your responses...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Typography color="error" variant="h5" gutterBottom>
          Oops! Something went wrong
        </Typography>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (submitted) {
    return (
      <Container maxWidth="sm">
        <Fade in={true}>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="100vh"
            textAlign="center"
          >
            <Paper
              elevation={3}
              sx={{
                p: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                maxWidth: 600,
              }}
            >
              <Typography variant="h4" gutterBottom color="primary">
                Thank You!
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Your leadership assessment has been submitted successfully.
              </Typography>
            </Paper>
          </Box>
        </Fade>
      </Container>
    );
  }

  const question = allQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / allQuestions.length) * 100;
  const currentPractice = assessmentFramework.practices.find((p) =>
    question.id.startsWith(p.id)
  );

  return (
    <Container maxWidth="lg">
      <Slide direction="up" in={true} mountOnEnter unmountOnExit>
        <Box
          sx={{
            mt: 4,
            mb: 4,
            width: "1000px",
            mx: "auto",
          }}
        >
          <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom color="primary">
              {assessmentFramework.framework}
            </Typography>
            {currentPractice && (
              <Typography
                variant="h6"
                color="primary"
                gutterBottom
                sx={{ mb: 2 }}
              >
                {currentPractice.name}
              </Typography>
            )}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Question {currentQuestion + 1} of {allQuestions.length}
              </Typography>
              <Box
                sx={{
                  width: "100%",
                  bgcolor: "grey.200",
                  borderRadius: 1,
                  height: 8,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width: `${progress}%`,
                    height: "100%",
                    bgcolor: "primary.main",
                    borderRadius: 1,
                    transition: "width 0.5s ease-in-out",
                  }}
                />
              </Box>
            </Box>
            <Divider sx={{ my: 3 }} />
            <Typography
              variant="h6"
              gutterBottom
              sx={{ mb: 3, fontWeight: 500 }}
            >
              {getModifiedQuestion(question.text)}
            </Typography>
            <Box
              sx={{
                mt: 4,
                mb: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {question.type === "rating" ? (
                <Fade in={true}>
                  <Box sx={{ width: "100%", maxWidth: 600 }}>
                    <FormControl component="fieldset" sx={{ width: "100%" }}>
                      <RadioGroup
                        value={rating?.toString() || ""}
                        onChange={(e) => setRating(Number(e.target.value))}
                      >
                        {assessmentFramework.scale.options.map((option) => (
                          <FormControlLabel
                            key={option.value}
                            value={option.value.toString()}
                            control={<Radio />}
                            label={option.label}
                            sx={{
                              mb: 1,
                              p: 1,
                              borderRadius: 1,
                              "&:hover": {
                                bgcolor: "action.hover",
                              },
                            }}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() =>
                        rating && handleResponse(rating.toString())
                      }
                      disabled={!rating}
                      sx={{ mt: 3 }}
                      fullWidth
                    >
                      {currentQuestion < allQuestions.length - 1
                        ? "Next Question"
                        : "Submit Assessment"}
                    </Button>
                  </Box>
                </Fade>
              ) : (
                <Fade in={true}>
                  <Box sx={{ width: "100%", maxWidth: 600 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      value={openResponse}
                      onChange={(e) => setOpenResponse(e.target.value)}
                      placeholder="Enter your response here..."
                      sx={{ mb: 3 }}
                      variant="outlined"
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleResponse(openResponse)}
                      disabled={!openResponse.trim()}
                      fullWidth
                    >
                      {currentQuestion < allQuestions.length - 1
                        ? "Next Question"
                        : "Submit Assessment"}
                    </Button>
                  </Box>
                </Fade>
              )}
            </Box>
          </Paper>
        </Box>
      </Slide>
    </Container>
  );
};

// Main App component
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Assessment />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
