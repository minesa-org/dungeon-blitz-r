#pragma once

#include "ChatTypes.hpp"
#include "discord_social_sdk/include/discordpp.h"

#include <atomic>
#include <functional>
#include <optional>
#include <thread>
#include <string>

namespace dungeon_blitz::bridge {

struct DiscordBridgeConfig {
    std::string appId;
    std::string lobbySecret;
    std::string linkedChannelId;
    std::string playerDisplayName;
    std::string tokenCachePath;
    int gameWindowPid { 0 };
    bool useDeviceFlow { false };
    bool enableChannelLinking { false };
};

struct DeviceAuthorizationInfo {
    std::string verificationUri;
    std::string userCode;
};

struct ChannelLinkError {
    int errorCode { 0 };
    int httpStatus { 0 };
    std::string error;
    std::string responseBody;
    std::string summary;
};

class DiscordBridge {
  public:
    using DiscordMessageCallback = std::function<void(const ChatMessage&)>;

    DiscordBridge();
    ~DiscordBridge();

    bool initialize(const DiscordBridgeConfig& config);
    bool tryRestoreSession();
    std::optional<DeviceAuthorizationInfo> beginDeviceAuthorization();
    bool joinOrCreateLobby();
    bool linkChannelToLobby(const std::string& lobbyId, const std::string& channelId);
    bool useLobby(const std::string& lobbyId, const std::string& channelId);
    bool sendToLobby(const ChatMessage& message);

    // Should be called from main server loop (or dedicated bridge thread).
    void tick();

    void setOnDiscordMessage(DiscordMessageCallback cb);

  private:
    void bindDiscordEvents();
    void handleIncomingDiscordMessage(const discordpp::MessageHandle& message);
    void startCallbackPump();
    void stopCallbackPump();
    void inspectLinkedChannelConflict(
        const std::string& lobbyId,
        const std::string& channelId,
        ChannelLinkError error
    );
    void emitChannelLinked(const std::string& lobbyId, const std::string& channelId, bool reusedExisting) const;
    void emitChannelLinkFailed(
        const std::string& lobbyId,
        const std::string& channelId,
        const ChannelLinkError& error
    ) const;
    void emitChannelLinkConflict(
        const std::string& lobbyId,
        const std::string& channelId,
        std::uint64_t existingLobbyId,
        std::uint64_t existingApplicationId,
        const ChannelLinkError& error
    ) const;
    bool tryUseLoadedLobby(std::uint64_t lobbyId, const std::string& channelId, bool emitWaitingStatus);
    void beginAuthorizationAfterTokenFailure();
    std::string buildLobbySecret() const;
    void connectWithToken(discordpp::AuthorizationTokenType tokenType, const std::string& accessToken);
    bool loadCachedTokens();
    void persistTokens() const;
    void clearCachedTokens();

    DiscordBridgeConfig config_;
    DiscordMessageCallback onDiscordMessage_;
    std::atomic<bool> initialized_ { false };
    std::atomic<bool> lobbyReady_ { false };
    std::atomic<bool> clientReady_ { false };
    std::atomic<bool> authInFlight_ { false };
    std::atomic<bool> callbackPumpRunning_ { false };
    std::thread callbackPumpThread_;
    std::string accessToken_;
    std::string refreshToken_;
    std::string pkceVerifier_;
    std::string pendingLinkedChannelId_;
    std::uint64_t lobbyId_ { 0 };
    std::uint64_t pendingLinkedLobbyId_ { 0 };

    discordpp::Client* client_ { nullptr };
};

} // namespace dungeon_blitz::bridge
