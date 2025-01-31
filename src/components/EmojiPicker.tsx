import { useTheme } from "@emotion/react";
import styled from "@emotion/styled";
import { AddReaction, AutoAwesome, Edit, RemoveCircleOutline } from "@mui/icons-material";
import {
  Avatar,
  Badge,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
} from "@mui/material";
import { Emoji, EmojiClickData, EmojiStyle, SuggestionMode, Theme } from "emoji-picker-react";
import {
  CSSProperties,
  Dispatch,
  SetStateAction,
  Suspense,
  lazy,
  useContext,
  useEffect,
  useState,
} from "react";
import { UserContext } from "../contexts/UserContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { DialogBtn, fadeIn } from "../styles";
import { ColorPalette } from "../theme/themeConfig";
import { getFontColor, showToast, systemInfo } from "../utils";
import { CATEGORY_NAME_MAX_LENGTH, TASK_NAME_MAX_LENGTH } from "../constants";
import { AITextSession } from "../types/ai";
import { CustomDialogTitle } from "./DialogTitle";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
interface EmojiPickerProps {
  emoji?: string;
  setEmoji: Dispatch<SetStateAction<string | null>>;
  color?: string;
  width?: CSSProperties["width"];
  name?: string;
  type?: "task" | "category";
}

export const CustomEmojiPicker = ({
  emoji,
  setEmoji,
  color,
  width,
  name,
  type,
}: EmojiPickerProps) => {
  const { user, setUser } = useContext(UserContext);
  const { emojisStyle, settings } = user;
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [currentEmoji, setCurrentEmoji] = useState<string | null>(emoji || null);

  const isOnline = useOnlineStatus();
  const emotionTheme = useTheme();

  interface EmojiItem {
    unified: string;
    original: string;
    count: number;
  }

  const getFrequentlyUsedEmojis = (): string[] => {
    const frequentlyUsedEmojis: EmojiItem[] | null = JSON.parse(
      localStorage.getItem("epr_suggested") || "null",
    );

    if (!frequentlyUsedEmojis) {
      return [];
    }

    frequentlyUsedEmojis.sort((a, b) => b.count - a.count);
    const topEmojis: EmojiItem[] = frequentlyUsedEmojis.slice(0, 6);
    const topUnified: string[] = topEmojis.map((item) => item.unified);

    return topUnified;
  };

  // When the currentEmoji state changes, update the parent component's emoji state
  useEffect(() => {
    setEmoji(currentEmoji);
  }, [currentEmoji, setEmoji]);

  // When the emoji prop changes to an empty string, set the currentEmoji state to undefined
  useEffect(() => {
    if (emoji === "") {
      setCurrentEmoji(null);
    }
  }, [emoji]);

  // Function to toggle the visibility of the EmojiPicker
  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prevState) => !prevState);
  };

  // Handler function for when an emoji is clicked in the EmojiPicker
  const handleEmojiClick = (e: EmojiClickData) => {
    toggleEmojiPicker();
    setCurrentEmoji(e.unified);
    console.log(e);
  };

  const handleRemoveEmoji = () => {
    toggleEmojiPicker();
    setCurrentEmoji(null);
  };

  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [session, setSession] = useState<AITextSession | null>(null);

  // Create Session on component mount for faster first load
  useEffect(() => {
    const createSession = async () => {
      if (window.ai) {
        const session = await window.ai.createTextSession();
        setSession(session);
      }
    };
    createSession();
  }, []);

  // ‼ This feature works only in Chrome (Dev / Canary) version 127 or higher with some flags enabled
  // https://afficone.com/blog/window-ai-new-chrome-feature-api/
  async function useAI(): Promise<void> {
    const start = new Date().getTime();
    setIsAILoading(true);
    try {
      const sessionInstance: AITextSession = session || (await window.ai.createTextSession());
      const response = await sessionInstance.prompt(
        `Choose a single emoji that best represents the ${
          type || "task"
        }: ${name}. (For example: 🖥️ for coding, 📝 for writing, 🎨 for design, 📱 for mobile development) Please use the actual emoji, do not use shortcodes. Type 'none' if not applicable.`,
      );
      console.log("Full AI response:", response);

      // Map to replace emoji shortcodes with actual emojis due to AI occasionally returning shortcodes.
      const emojiMap: {
        [key: string]: string;
      } = {
        ":joy:": "😄",
        ":smile:": "😄",
        ":heart:": "❤️",
        "<3": "❤️",
        ":sunglasses:": "😎",
        ":thinking_head:": "🤔",
        ":technology:": "💻",
        ":tech:": "💻",
        ":ml:": "🧠",
        ":wave:": "👋",
        ":O": "😮",
        "☮": "✌️",
        "🎙": "🎙️",
        "🗣": "🗣️",
      };
      let emojiResponse = response.trim();
      if (emojiMap[emojiResponse]) {
        emojiResponse = emojiMap[emojiResponse];
      }

      // Validate if userInput is a valid emoji
      const emojiRegex = /[\p{Emoji}]/u;

      const unified = emojiToUnified(emojiResponse.replaceAll(":", ""));
      if (emojiRegex.test(emojiResponse)) {
        setIsAILoading(false);

        console.log("Emoji unified:", unified);
        setCurrentEmoji(unified);
      } else {
        setCurrentEmoji(null);
        showToast(`Invalid emoji. Please try again with different ${type} name.`, {
          type: "error",
        });
        console.error("Invalid emoji.", unified);
      }

      setIsAILoading(false);
      const end = new Date().getTime();
      console.log(
        `%cTook ${end - start}ms to generate.`,
        `color: ${end - start > 600 ? "orange" : "lime"}`,
      );
    } catch (error) {
      setIsAILoading(false);
      console.error(error);
      showToast(`${error}`, { type: "error" });
    }
  }

  const emojiToUnified = (emoji: string): string =>
    [...emoji]
      .map((char) => (char ? (char.codePointAt(0)?.toString(16).toUpperCase() ?? "") : ""))
      .join("-")
      .toLowerCase();

  // end of AI experimental feature code

  // Function to render the content of the Avatar based on whether an emoji is selected or not
  const renderAvatarContent = () => {
    const fontColor = color ? getFontColor(color) : ColorPalette.fontLight;
    if (isAILoading) {
      return <CircularProgress size={40} thickness={5} sx={{ color: fontColor }} />;
    }
    if (currentEmoji) {
      const emojiSize =
        emojisStyle === EmojiStyle.NATIVE && systemInfo.os === "iOS"
          ? 64
          : emojisStyle === EmojiStyle.NATIVE
            ? 48
            : 64;

      return (
        <EmojiElement key={currentEmoji}>
          <Emoji size={emojiSize} emojiStyle={emojisStyle} unified={currentEmoji} />
        </EmojiElement>
      );
    } else {
      return (
        <AddReaction
          sx={{
            fontSize: "52px",
            color: fontColor,
            transition: ".3s all",
          }}
        />
      );
    }
  };

  return (
    <>
      <EmojiContainer>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          badgeContent={
            <EditBadge onClick={toggleEmojiPicker}>
              <Edit />
            </EditBadge>
          }
        >
          <EmojiAvatar clr={color} onClick={toggleEmojiPicker}>
            {renderAvatarContent()}
          </EmojiAvatar>
        </Badge>
      </EmojiContainer>
      {"ai" in window && name && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Button
            onClick={useAI}
            disabled={
              name?.length < 3 ||
              (type === "task"
                ? name.length > TASK_NAME_MAX_LENGTH
                : name.length > CATEGORY_NAME_MAX_LENGTH)
            }
            style={{ marginBottom: "4px" }}
          >
            <AutoAwesome /> &nbsp; Find emoji with AI
          </Button>
        </div>
      )}
      {/* Simple Emoji Picker */}
      {showEmojiPicker && user.settings[0].simpleEmojiPicker && (
        <SimplePickerContainer>
          <Suspense fallback={<CircularProgress size={40} thickness={5} />}>
            <EmojiPicker
              style={{ border: "none" }}
              reactionsDefaultOpen
              lazyLoadEmojis
              reactions={getFrequentlyUsedEmojis()}
              emojiStyle={emojisStyle}
              onReactionClick={handleEmojiClick}
              allowExpandReactions={false}
              theme={emotionTheme.darkmode ? Theme.DARK : Theme.LIGHT}
              autoFocusSearch={false}
            />
          </Suspense>
        </SimplePickerContainer>
      )}

      {showEmojiPicker && !user.settings[0].simpleEmojiPicker && (
        <>
          <Dialog
            open={showEmojiPicker}
            onClose={toggleEmojiPicker}
            PaperProps={{
              style: {
                padding: "12px",
                borderRadius: "24px",
                minWidth: "400px",
              },
            }}
          >
            <CustomDialogTitle
              title="Choose Emoji"
              subTitle={`Choose the perfect emoji for your ${type}.`}
              onClose={toggleEmojiPicker}
              icon={<AddReaction />}
            />
            {!isOnline &&
              emojisStyle !== EmojiStyle.NATIVE && ( //TODO: design this better
                <OfflineContainer width={width}>
                  <span>
                    Emojis may not load correctly when offline. Try switching to the native emoji
                    style.
                    <br />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setUser((prevUser) => ({
                          ...prevUser,
                          emojisStyle: EmojiStyle.NATIVE,
                        }));
                        setShowEmojiPicker(false);
                      }}
                    >
                      Change Style
                    </Button>
                  </span>
                </OfflineContainer>
              )}
            <EmojiPickerContainer>
              <Suspense
                fallback={
                  !settings[0].simpleEmojiPicker && (
                    <PickerLoader
                      pickerTheme={emotionTheme.darkmode ? "dark" : "light"}
                    ></PickerLoader>
                  )
                }
              >
                <EmojiPicker
                  width="100vw"
                  height="550px"
                  reactionsDefaultOpen={
                    settings[0].simpleEmojiPicker && getFrequentlyUsedEmojis().length !== 0
                  }
                  reactions={getFrequentlyUsedEmojis()}
                  emojiStyle={emojisStyle}
                  theme={emotionTheme.darkmode ? Theme.DARK : Theme.LIGHT}
                  suggestedEmojisMode={SuggestionMode.FREQUENT}
                  autoFocusSearch={false}
                  onEmojiClick={handleEmojiClick}
                  searchPlaceHolder="Search emoji"
                  previewConfig={{
                    defaultEmoji: "1f4dd",
                    defaultCaption: `Choose the perfect emoji for your ${type}`,
                  }}
                />
              </Suspense>
            </EmojiPickerContainer>
            <DialogActions>
              <DialogBtn onClick={toggleEmojiPicker}>Cancel</DialogBtn>
              {currentEmoji && (
                <DialogBtn color="error" onClick={handleRemoveEmoji}>
                  <RemoveCircleOutline /> &nbsp; Remove Emoji
                </DialogBtn>
              )}
            </DialogActions>
          </Dialog>
        </>
      )}
    </>
  );
};

const EmojiContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 14px;
`;

const EmojiPickerContainer = styled(DialogContent)`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px;
  animation: ${fadeIn} 0.4s ease-in;
  padding: 0;
`;

const SimplePickerContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px;
  animation: ${fadeIn} 0.4s ease-in;
  padding: 0;
`;

const EmojiAvatar = styled(Avatar)<{ clr: string | undefined }>`
  background: ${({ clr, theme }) => clr || theme.primary};
  transition: 0.3s all;
  cursor: pointer;
  width: 96px;
  height: 96px;
`;

const EditBadge = styled(Avatar)`
  background: #9c9c9c81;
  backdrop-filter: blur(6px);
  cursor: pointer;
`;

const OfflineContainer = styled.div<{ width?: CSSProperties["width"] | undefined }>`
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: ${({ width }) => width || "350px"};
  margin: 6px auto -6px auto;
  & span {
    margin: 0;
    font-size: 14px;
    text-align: center;
  }
`;

const PickerLoader = styled.div<{
  pickerTheme: "light" | "dark" | undefined;
  width?: CSSProperties["width"] | undefined;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ width }) => width || "350px"};
  height: 500px;
  padding: 8px;
  border-radius: 20px;
  background: ${({ pickerTheme }) => (pickerTheme === "dark" ? "#222222" : "#ffffff")};
  border: ${({ pickerTheme }) => `1px solid ${pickerTheme === "dark" ? "#151617" : "#e7e7e7"}`};
`;

const EmojiElement = styled.div`
  animation: ${fadeIn} 0.4s ease-in;
`;
