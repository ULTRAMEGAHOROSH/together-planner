package com.togetherplanner.user.mapper;

import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.user.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt());
    }
}
